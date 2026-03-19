import { memFire } from './memfire'
import { hashPassword } from './passwordHash'

const TABLE = 'admin_accounts'

function prettyError(error) {
  const msg = error?.message || ''
  if (msg.includes('relation') && msg.includes('does not exist')) {
    return '缺少 admin_accounts 数据表，请先执行 sql/admin_accounts.sql'
  }
  if (msg.includes('password_hash')) {
    return '缺少 password_hash 字段，请先执行 sql/admin_accounts.sql'
  }
  return msg || '请求失败'
}

export async function loginAdmin({ loginId, password }) {
  const id = (loginId || '').trim().toLowerCase()
  if (!id || !password) throw new Error('请输入管理员账号和密码')

  const { data, error } = await memFire
    .from(TABLE)
    .select('id, login_id, display_name, password_hash, is_active')
    .eq('login_id', id)
    .limit(1)

  if (error) throw new Error(prettyError(error))
  if (!data?.length) throw new Error('账号或密码错误')

  const account = data[0]
  if (account.is_active === false) throw new Error('该管理员账号已停用')
  if (!account.password_hash) throw new Error('管理员账号未配置密码哈希')

  const digest = await hashPassword(password)
  if (digest !== account.password_hash) throw new Error('账号或密码错误')

  return {
    id: account.id,
    login_id: account.login_id,
    display_name: account.display_name || 'Admin'
  }
}

