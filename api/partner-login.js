import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const TABLE = 'partner_accounts'
const AUDIT_TABLE = 'partner_login_audit_logs'
const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 15
const LOCK_MS = LOCK_MINUTES * 60 * 1000

function json(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8')
  res.send(JSON.stringify(payload))
}

function getEnv(name) {
  return process.env[name] || ''
}

function getIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim()
  if (Array.isArray(xff) && xff[0]) return String(xff[0]).split(',')[0].trim()
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim()
  const cfIp = req.headers['cf-connecting-ip']
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim()
  return ''
}

function formatLockUntil(ts) {
  if (!ts) return ''
  const dt = new Date(ts)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleString('zh-CN', { hour12: false })
}

function createAuthError(message, code, status = 400) {
  const err = new Error(message)
  err.code = code
  err.status = status
  return err
}

function sha256Hex(value) {
  return createHash('sha256').update(String(value || '')).digest('hex')
}

function createScryptHash(password) {
  const salt = randomBytes(16)
  const N = 16384
  const r = 8
  const p = 1
  const key = scryptSync(String(password || ''), salt, 64, { N, r, p })
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${key.toString('hex')}`
}

function verifyPassword(password, storedHash) {
  const raw = String(storedHash || '')
  if (!raw) return { ok: false, upgrade: false }

  if (!raw.startsWith('scrypt$')) {
    return { ok: sha256Hex(password) === raw, upgrade: true }
  }

  const parts = raw.split('$')
  if (parts.length !== 6) return { ok: false, upgrade: false }

  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = Buffer.from(parts[4], 'hex')
  const expected = Buffer.from(parts[5], 'hex')
  if (!N || !r || !p || !salt.length || !expected.length) return { ok: false, upgrade: false }
  const got = scryptSync(String(password || ''), salt, expected.length, { N, r, p })
  if (got.length !== expected.length) return { ok: false, upgrade: false }
  return { ok: timingSafeEqual(got, expected), upgrade: false }
}

function prettyError(error) {
  const msg = error?.message || ''
  if (msg.includes('relation') && msg.includes('does not exist')) {
    if (msg.includes(AUDIT_TABLE)) return '缺少商户登录审计表，请先执行 sql/partner_login_security_audit.sql'
    return '缺少 partner_accounts 数据表，请先执行 sql/partner_accounts.sql'
  }
  if (msg.includes('failed_attempts') || msg.includes('lock_until') || msg.includes('last_login_at') || msg.includes('is_active')) {
    return '缺少商户登录安全字段，请先执行 sql/partner_login_security_audit.sql'
  }
  if (msg.includes('password_hash')) return '缺少 password_hash 字段，请先执行 sql/migrate_partner_accounts_password_hash.sql'
  return msg || '请求失败'
}

async function writeLoginAudit(memFire, {
  accountId = null,
  email,
  status,
  reason = null,
  failedCount = null,
  lockedUntil = null,
  ip = null,
  userAgent = null
}) {
  try {
    await memFire.from(AUDIT_TABLE).insert({
      partner_account_id: accountId,
      email,
      status,
      reason,
      failed_count: failedCount,
      locked_until: lockedUntil,
      ip_address: ip,
      user_agent: userAgent
    })
  } catch (error) {
    console.warn('[api/partner-login] writeLoginAudit failed:', error?.message || error)
  }
}

async function loginPartner(memFire, { email, password, ip, userAgent }) {
  const emailTrim = (email || '').trim().toLowerCase()
  if (!emailTrim || !password) throw createAuthError('请输入邮箱和密码', 'INVALID_INPUT', 400)

  const { data, error } = await memFire
    .from(TABLE)
    .select('id, email, bar_id, password_hash, is_active, failed_attempts, lock_until')
    .eq('email', emailTrim)
    .limit(1)

  if (error) throw createAuthError(prettyError(error), 'DB_ERROR', 500)

  if (!data?.length) {
    await writeLoginAudit(memFire, {
      email: emailTrim,
      status: 'failure',
      reason: 'invalid_credentials',
      ip,
      userAgent
    })
    throw createAuthError('邮箱或密码错误，请核对后重试', 'INVALID_CREDENTIALS', 401)
  }

  const account = data[0]
  const now = Date.now()
  const lockedUntilMs = account.lock_until ? new Date(account.lock_until).getTime() : 0

  if (account.is_active === false) {
    await writeLoginAudit(memFire, {
      accountId: account.id,
      email: account.email,
      status: 'failure',
      reason: 'account_disabled',
      failedCount: account.failed_attempts || 0,
      lockedUntil: account.lock_until,
      ip,
      userAgent
    })
    throw createAuthError('该商户账号已停用，请联系管理员', 'ACCOUNT_DISABLED', 403)
  }

  if (lockedUntilMs && now < lockedUntilMs) {
    await writeLoginAudit(memFire, {
      accountId: account.id,
      email: account.email,
      status: 'failure',
      reason: 'account_locked',
      failedCount: account.failed_attempts || 0,
      lockedUntil: account.lock_until,
      ip,
      userAgent
    })
    throw createAuthError(`账号已锁定，请于 ${formatLockUntil(account.lock_until)} 后重试`, 'ACCOUNT_LOCKED', 423)
  }

  const verify = verifyPassword(password, account.password_hash)
  if (!verify.ok) {
    const currentFailed = Number(account.failed_attempts || 0)
    const nextFailed = currentFailed + 1
    const shouldLock = nextFailed >= MAX_FAILED_ATTEMPTS
    const nextLockUntil = shouldLock ? new Date(now + LOCK_MS).toISOString() : null
    const persistedFailed = shouldLock ? 0 : nextFailed

    const { error: updateError } = await memFire
      .from(TABLE)
      .update({
        failed_attempts: persistedFailed,
        lock_until: nextLockUntil
      })
      .eq('id', account.id)
    if (updateError) throw createAuthError(prettyError(updateError), 'DB_ERROR', 500)

    await writeLoginAudit(memFire, {
      accountId: account.id,
      email: account.email,
      status: 'failure',
      reason: shouldLock ? 'invalid_credentials_lock' : 'invalid_credentials',
      failedCount: nextFailed,
      lockedUntil: nextLockUntil,
      ip,
      userAgent
    })

    if (shouldLock) {
      throw createAuthError(`邮箱或密码错误，已连续失败 ${MAX_FAILED_ATTEMPTS} 次，账号锁定 ${LOCK_MINUTES} 分钟`, 'ACCOUNT_LOCKED', 423)
    }
    const left = MAX_FAILED_ATTEMPTS - nextFailed
    throw createAuthError(`邮箱或密码错误，还可尝试 ${left} 次`, 'INVALID_CREDENTIALS', 401)
  }

  const updates = {
    failed_attempts: 0,
    lock_until: null,
    last_login_at: new Date(now).toISOString(),
    last_login_ip: ip,
    last_login_user_agent: userAgent
  }
  if (verify.upgrade) {
    updates.password_hash = createScryptHash(password)
  }

  const { error: successUpdateError } = await memFire
    .from(TABLE)
    .update(updates)
    .eq('id', account.id)
  if (successUpdateError) throw createAuthError(prettyError(successUpdateError), 'DB_ERROR', 500)

  await writeLoginAudit(memFire, {
    accountId: account.id,
    email: account.email,
    status: 'success',
    reason: verify.upgrade ? 'login_success_hash_upgraded' : 'login_success',
    failedCount: 0,
    ip,
    userAgent
  })

  return {
    id: account.id,
    email: account.email,
    bar_id: account.bar_id || null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { ok: false, message: 'Method Not Allowed' })
  }

  const memFireUrl = getEnv('MEMFIRE_URL') || getEnv('VITE_MEMFIRE_URL')
  const memFireServiceRoleKey = getEnv('MEMFIRE_SERVICE_ROLE_KEY')
  if (!memFireUrl || !memFireServiceRoleKey) {
    return json(res, 500, { ok: false, message: '缺少 MEMFIRE_URL 或 MEMFIRE_SERVICE_ROLE_KEY 环境变量' })
  }

  const memFire = createClient(memFireUrl, memFireServiceRoleKey, {
    auth: { persistSession: false }
  })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const email = body.email
    const password = body.password
    const userAgent = (body.userAgent || req.headers['user-agent'] || '').toString()
    const ip = getIp(req) || null
    const account = await loginPartner(memFire, { email, password, ip, userAgent })
    return json(res, 200, { ok: true, account })
  } catch (error) {
    const status = Number(error?.status || 500)
    const code = error?.code || 'UNKNOWN'
    const message = error?.message || '登录失败，请稍后重试'
    return json(res, status, { ok: false, code, message })
  }
}
