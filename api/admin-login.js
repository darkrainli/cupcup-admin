import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const TABLE = 'admin_accounts'
const AUDIT_TABLE = 'admin_login_audit_logs'
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

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex')
}

function createAuthError(message, code, status = 400) {
  const err = new Error(message)
  err.code = code
  err.status = status
  return err
}

function prettyError(error) {
  const msg = error?.message || ''
  if (msg.includes('relation') && msg.includes('does not exist')) {
    if (msg.includes(AUDIT_TABLE)) return '缺少登录审计日志表，请先执行 sql/admin_login_security_audit.sql'
    return '缺少 admin_accounts 数据表，请先执行 sql/admin_accounts.sql'
  }
  if (msg.includes('failed_attempts') || msg.includes('lock_until') || msg.includes('last_login_at')) {
    return '缺少登录安全字段，请先执行 sql/admin_login_security_audit.sql'
  }
  if (msg.includes('password_hash')) return '缺少 password_hash 字段，请先执行 sql/admin_accounts.sql'
  return msg || '请求失败'
}

async function writeLoginAudit(memFire, {
  accountId = null,
  loginId,
  status,
  reason = null,
  failedCount = null,
  lockedUntil = null,
  ip = null,
  userAgent = null
}) {
  try {
    await memFire.from(AUDIT_TABLE).insert({
      admin_account_id: accountId,
      login_id: loginId,
      status,
      reason,
      failed_count: failedCount,
      locked_until: lockedUntil,
      ip_address: ip,
      user_agent: userAgent
    })
  } catch (error) {
    console.warn('[api/admin-login] writeLoginAudit failed:', error?.message || error)
  }
}

async function loginAdmin(memFire, { loginId, password, ip, userAgent }) {
  const id = (loginId || '').trim().toLowerCase()
  if (!id || !password) throw createAuthError('请输入管理员账号和密码', 'INVALID_INPUT', 400)

  const { data, error } = await memFire
    .from(TABLE)
    .select('id, login_id, display_name, password_hash, is_active, failed_attempts, lock_until')
    .eq('login_id', id)
    .limit(1)

  if (error) throw createAuthError(prettyError(error), 'DB_ERROR', 500)

  if (!data?.length) {
    await writeLoginAudit(memFire, {
      loginId: id,
      status: 'failure',
      reason: 'invalid_credentials',
      ip,
      userAgent
    })
    throw createAuthError('账号或密码错误', 'INVALID_CREDENTIALS', 401)
  }

  const account = data[0]
  const now = Date.now()
  const lockedUntilMs = account.lock_until ? new Date(account.lock_until).getTime() : 0

  if (account.is_active === false) {
    await writeLoginAudit(memFire, {
      accountId: account.id,
      loginId: account.login_id,
      status: 'failure',
      reason: 'account_disabled',
      failedCount: account.failed_attempts || 0,
      lockedUntil: account.lock_until,
      ip,
      userAgent
    })
    throw createAuthError('该管理员账号已停用', 'ACCOUNT_DISABLED', 403)
  }

  if (lockedUntilMs && now < lockedUntilMs) {
    await writeLoginAudit(memFire, {
      accountId: account.id,
      loginId: account.login_id,
      status: 'failure',
      reason: 'account_locked',
      failedCount: account.failed_attempts || 0,
      lockedUntil: account.lock_until,
      ip,
      userAgent
    })
    throw createAuthError(`账号已锁定，请于 ${formatLockUntil(account.lock_until)} 后重试`, 'ACCOUNT_LOCKED', 423)
  }

  if (!account.password_hash) {
    await writeLoginAudit(memFire, {
      accountId: account.id,
      loginId: account.login_id,
      status: 'failure',
      reason: 'password_hash_missing',
      failedCount: account.failed_attempts || 0,
      ip,
      userAgent
    })
    throw createAuthError('管理员账号未配置密码哈希', 'PASSWORD_HASH_MISSING', 500)
  }

  const digest = hashPassword(password)
  if (digest !== account.password_hash) {
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
      loginId: account.login_id,
      status: 'failure',
      reason: shouldLock ? 'invalid_credentials_lock' : 'invalid_credentials',
      failedCount: nextFailed,
      lockedUntil: nextLockUntil,
      ip,
      userAgent
    })

    if (shouldLock) {
      throw createAuthError(`账号或密码错误，已连续失败 ${MAX_FAILED_ATTEMPTS} 次，账号锁定 ${LOCK_MINUTES} 分钟`, 'ACCOUNT_LOCKED', 423)
    }
    const left = MAX_FAILED_ATTEMPTS - nextFailed
    throw createAuthError(`账号或密码错误，还可尝试 ${left} 次`, 'INVALID_CREDENTIALS', 401)
  }

  const { error: successUpdateError } = await memFire
    .from(TABLE)
    .update({
      failed_attempts: 0,
      lock_until: null,
      last_login_at: new Date(now).toISOString(),
      last_login_user_agent: userAgent
    })
    .eq('id', account.id)

  if (successUpdateError) throw createAuthError(prettyError(successUpdateError), 'DB_ERROR', 500)

  await writeLoginAudit(memFire, {
    accountId: account.id,
    loginId: account.login_id,
    status: 'success',
    reason: 'login_success',
    failedCount: 0,
    ip,
    userAgent
  })

  return {
    id: account.id,
    login_id: account.login_id,
    display_name: account.display_name || 'Admin'
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method Not Allowed' })
  }

  const memFireUrl = getEnv('MEMFIRE_URL') || getEnv('VITE_MEMFIRE_URL')
  const memFireServiceRoleKey = getEnv('MEMFIRE_SERVICE_ROLE_KEY')

  if (!memFireUrl || !memFireServiceRoleKey) {
    return json(res, 500, {
      error: 'Server config missing',
      message: '缺少 MEMFIRE_URL 或 MEMFIRE_SERVICE_ROLE_KEY 环境变量'
    })
  }

  const memFire = createClient(memFireUrl, memFireServiceRoleKey, {
    auth: { persistSession: false }
  })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const loginId = body.loginId
    const password = body.password
    const userAgent = (body.userAgent || req.headers['user-agent'] || '').toString()
    const ip = getIp(req) || null

    const account = await loginAdmin(memFire, { loginId, password, ip, userAgent })
    return json(res, 200, { ok: true, account })
  } catch (error) {
    const status = Number(error?.status || 500)
    const code = error?.code || 'UNKNOWN'
    const message = error?.message || '登录失败，请稍后重试'
    return json(res, status, { ok: false, code, message })
  }
}
