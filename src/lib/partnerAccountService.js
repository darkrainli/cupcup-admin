import { memFire } from './memfire'

const TABLE = 'partner_accounts'

function prettyError(error) {
  const msg = error?.message || ''
  if (msg.includes('relation') && msg.includes('does not exist')) {
    return '缺少 partner_accounts 数据表，请先执行 SQL 建表'
  }
  return msg || '请求失败'
}

export function generatePartnerPassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function listPartnerAccounts() {
  const { data, error } = await memFire
    .from(TABLE)
    .select('id, email, password, bar_id, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error(prettyError(error))
  return data || []
}

export async function createPartnerAccount({ email, password }) {
  const emailTrim = (email || '').trim().toLowerCase()
  if (!emailTrim) throw new Error('请输入邮箱')
  if (!password || password.length < 6) throw new Error('密码至少 6 位')

  const { data: exists, error: existsError } = await memFire
    .from(TABLE)
    .select('id')
    .eq('email', emailTrim)
    .limit(1)

  if (existsError) throw new Error(prettyError(existsError))
  if (exists?.length) throw new Error('该邮箱已开通过商户账号')

  const { data, error } = await memFire
    .from(TABLE)
    .insert([{
      email: emailTrim,
      password,
      bar_id: null
    }])
    .select('id, email, password, bar_id, created_at, updated_at')
    .single()

  if (error) throw new Error(prettyError(error))
  return data
}

export async function resetPartnerPassword({ id, password }) {
  if (!id) throw new Error('缺少账号 ID')
  if (!password || password.length < 6) throw new Error('密码至少 6 位')

  const { error } = await memFire
    .from(TABLE)
    .update({ password })
    .eq('id', id)

  if (error) throw new Error(prettyError(error))
}
