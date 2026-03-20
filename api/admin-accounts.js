import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const TABLE = 'admin_accounts'

function json(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8')
  res.send(JSON.stringify(payload))
}

function getEnv(name) {
  return process.env[name] || ''
}

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex')
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 64
}

export default async function handler(req, res) {
  const memFireUrl = getEnv('MEMFIRE_URL') || getEnv('VITE_MEMFIRE_URL')
  const memFireServiceRoleKey = getEnv('MEMFIRE_SERVICE_ROLE_KEY')
  if (!memFireUrl || !memFireServiceRoleKey) {
    return json(res, 500, { ok: false, message: '缺少 MEMFIRE_URL 或 MEMFIRE_SERVICE_ROLE_KEY 环境变量' })
  }

  const memFire = createClient(memFireUrl, memFireServiceRoleKey, {
    auth: { persistSession: false }
  })

  if (req.method === 'GET') {
    const { data, error } = await memFire
      .from(TABLE)
      .select('id, login_id, display_name, is_active, last_login_at, updated_at, created_at')
      .order('created_at', { ascending: false })

    if (error) return json(res, 500, { ok: false, message: error.message || '查询失败' })
    return json(res, 200, { ok: true, list: data || [] })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return json(res, 405, { ok: false, message: 'Method Not Allowed' })
  }

  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  } catch {
    return json(res, 400, { ok: false, message: '请求体格式错误' })
  }
  const action = body.action

  if (action === 'create') {
    const loginId = (body.loginId || '').trim().toLowerCase()
    const displayName = (body.displayName || '').trim() || 'CupCup Admin'
    const password = body.password || ''
    if (!loginId) return json(res, 400, { ok: false, message: '请输入管理员账号' })
    if (!validatePassword(password)) return json(res, 400, { ok: false, message: '密码长度需为 6-64 位' })

    const { data, error } = await memFire
      .from(TABLE)
      .insert({
        login_id: loginId,
        display_name: displayName,
        password_hash: hashPassword(password),
        is_active: true
      })
      .select('id, login_id, display_name, is_active, created_at')
      .single()

    if (error) {
      if (error.code === '23505') return json(res, 409, { ok: false, message: '管理员账号已存在' })
      return json(res, 500, { ok: false, message: error.message || '创建失败' })
    }
    return json(res, 200, { ok: true, account: data })
  }

  if (action === 'reset_password') {
    const id = body.id
    const password = body.password || ''
    if (!id) return json(res, 400, { ok: false, message: '缺少管理员 ID' })
    if (!validatePassword(password)) return json(res, 400, { ok: false, message: '密码长度需为 6-64 位' })

    const { error } = await memFire
      .from(TABLE)
      .update({ password_hash: hashPassword(password) })
      .eq('id', id)
    if (error) return json(res, 500, { ok: false, message: error.message || '重置失败' })
    return json(res, 200, { ok: true })
  }

  if (action === 'set_active') {
    const id = body.id
    const isActive = body.isActive === true
    const currentLoginId = (body.currentLoginId || '').trim().toLowerCase()
    if (!id) return json(res, 400, { ok: false, message: '缺少管理员 ID' })

    const { data: target, error: targetErr } = await memFire
      .from(TABLE)
      .select('id, login_id')
      .eq('id', id)
      .single()

    if (targetErr) return json(res, 500, { ok: false, message: targetErr.message || '操作失败' })
    if (!isActive && currentLoginId && target?.login_id === currentLoginId) {
      return json(res, 400, { ok: false, message: '不能停用当前登录账号' })
    }

    const { error } = await memFire
      .from(TABLE)
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) return json(res, 500, { ok: false, message: error.message || '操作失败' })
    return json(res, 200, { ok: true })
  }

  return json(res, 400, { ok: false, message: '无效操作' })
}
