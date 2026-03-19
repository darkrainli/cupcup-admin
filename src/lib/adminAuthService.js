import { memFire } from './memfire'
import { hashPassword } from './passwordHash'

const TABLE = 'admin_accounts'
const AUDIT_TABLE = 'admin_login_audit_logs'
const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 15
const LOCK_MS = LOCK_MINUTES * 60 * 1000

function createAuthError(message, code) {
  const err = new Error(message)
  if (code) err.code = code
  return err
}

function prettyError(error) {
  const msg = error?.message || ''
  if (msg.includes('relation') && msg.includes('does not exist')) {
    if (msg.includes(AUDIT_TABLE)) {
      return '缺少登录审计日志表，请先执行 sql/admin_login_security_audit.sql'
    }
    return '缺少 admin_accounts 数据表，请先执行 sql/admin_accounts.sql'
  }
  if (msg.includes('failed_attempts') || msg.includes('lock_until') || msg.includes('last_login_at')) {
    return '缺少登录安全字段，请先执行 sql/admin_login_security_audit.sql'
  }
  if (msg.includes('password_hash')) {
    return '缺少 password_hash 字段，请先执行 sql/admin_accounts.sql'
  }
  return msg || '请求失败'
}

function formatLockUntil(ts) {
  if (!ts) return ''
  const dt = new Date(ts)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleString('zh-CN', { hour12: false })
}

async function writeLoginAudit({
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
    console.warn('[adminAuthService] writeLoginAudit failed:', error?.message || error)
  }
}

export async function loginAdmin({ loginId, password, context = {} }) {
  const id = (loginId || '').trim().toLowerCase()
  const ip = (context?.ip || '').trim() || null
  const userAgent = (context?.userAgent || '').trim() || null

  if (!id || !password) throw createAuthError('请输入管理员账号和密码', 'INVALID_INPUT')

  const { data, error } = await memFire
    .from(TABLE)
    .select('id, login_id, display_name, password_hash, is_active, failed_attempts, lock_until')
    .eq('login_id', id)
    .limit(1)

  if (error) throw createAuthError(prettyError(error), 'DB_ERROR')
  if (!data?.length) {
    await writeLoginAudit({
      loginId: id,
      status: 'failure',
      reason: 'invalid_credentials',
      ip,
      userAgent
    })
    throw createAuthError('账号或密码错误', 'INVALID_CREDENTIALS')
  }

  const account = data[0]
  const now = Date.now()
  const lockedUntilMs = account.lock_until ? new Date(account.lock_until).getTime() : 0

  if (account.is_active === false) {
    await writeLoginAudit({
      accountId: account.id,
      loginId: account.login_id,
      status: 'failure',
      reason: 'account_disabled',
      failedCount: account.failed_attempts || 0,
      lockedUntil: account.lock_until,
      ip,
      userAgent
    })
    throw createAuthError('该管理员账号已停用', 'ACCOUNT_DISABLED')
  }

  if (lockedUntilMs && now < lockedUntilMs) {
    await writeLoginAudit({
      accountId: account.id,
      loginId: account.login_id,
      status: 'failure',
      reason: 'account_locked',
      failedCount: account.failed_attempts || 0,
      lockedUntil: account.lock_until,
      ip,
      userAgent
    })
    throw createAuthError(`账号已锁定，请于 ${formatLockUntil(account.lock_until)} 后重试`, 'ACCOUNT_LOCKED')
  }

  if (!account.password_hash) {
    await writeLoginAudit({
      accountId: account.id,
      loginId: account.login_id,
      status: 'failure',
      reason: 'password_hash_missing',
      failedCount: account.failed_attempts || 0,
      ip,
      userAgent
    })
    throw createAuthError('管理员账号未配置密码哈希', 'PASSWORD_HASH_MISSING')
  }

  const digest = await hashPassword(password)
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

    if (updateError) throw createAuthError(prettyError(updateError), 'DB_ERROR')

    await writeLoginAudit({
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
      throw createAuthError(`账号或密码错误，已连续失败 ${MAX_FAILED_ATTEMPTS} 次，账号锁定 ${LOCK_MINUTES} 分钟`, 'ACCOUNT_LOCKED')
    }

    const left = MAX_FAILED_ATTEMPTS - nextFailed
    throw createAuthError(`账号或密码错误，还可尝试 ${left} 次`, 'INVALID_CREDENTIALS')
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

  if (successUpdateError) throw createAuthError(prettyError(successUpdateError), 'DB_ERROR')

  await writeLoginAudit({
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
