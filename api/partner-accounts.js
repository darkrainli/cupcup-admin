import { createClient } from '@supabase/supabase-js'
import { randomBytes, scryptSync } from 'node:crypto'

const TABLE = 'partner_accounts'

function json(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8')
  res.send(JSON.stringify(payload))
}

function getEnv(name) {
  return process.env[name] || ''
}

function createScryptHash(password) {
  const salt = randomBytes(16)
  const N = 16384
  const r = 8
  const p = 1
  const key = scryptSync(String(password || ''), salt, 64, { N, r, p })
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${key.toString('hex')}`
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
      .select('id, email, bar_id, is_active, last_login_at, created_at, updated_at')
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
    const email = (body.email || '').trim().toLowerCase()
    const password = body.password || ''
    if (!email) return json(res, 400, { ok: false, message: '请输入邮箱' })
    if (!validatePassword(password)) return json(res, 400, { ok: false, message: '密码长度需为 6-64 位' })

    const { data: exists, error: existsError } = await memFire
      .from(TABLE)
      .select('id')
      .eq('email', email)
      .limit(1)
    if (existsError) return json(res, 500, { ok: false, message: existsError.message || '查询失败' })
    if (exists?.length) return json(res, 409, { ok: false, message: '该邮箱已开通过商户账号' })

    const { data, error } = await memFire
      .from(TABLE)
      .insert([{
        email,
        password_hash: createScryptHash(password),
        bar_id: null,
        is_active: true
      }])
      .select('id, email, bar_id, is_active, created_at, updated_at')
      .single()
    if (error) return json(res, 500, { ok: false, message: error.message || '创建失败' })
    return json(res, 200, { ok: true, account: data })
  }

  if (action === 'upsert_for_bar') {
    const barId = body.barId
    const email = (body.email || '').trim().toLowerCase()
    const password = body.password || ''
    if (!barId) return json(res, 400, { ok: false, message: '缺少门店 ID' })
    if (!email) return json(res, 400, { ok: false, message: '请输入邮箱' })
    if (!validatePassword(password)) return json(res, 400, { ok: false, message: '密码长度需为 6-64 位' })

    const { data: existingByEmail, error: checkErr } = await memFire
      .from(TABLE)
      .select('id, bar_id')
      .eq('email', email)
      .limit(1)
    if (checkErr) return json(res, 500, { ok: false, message: checkErr.message || '查询失败' })
    if (existingByEmail?.length && existingByEmail[0].bar_id && existingByEmail[0].bar_id !== barId) {
      return json(res, 409, { ok: false, message: '该邮箱已绑定其他门店账号' })
    }

    const { data: existingByBar, error: byBarErr } = await memFire
      .from(TABLE)
      .select('id')
      .eq('bar_id', barId)
      .limit(1)
    if (byBarErr) return json(res, 500, { ok: false, message: byBarErr.message || '查询失败' })

    if (existingByBar?.length) {
      const { data, error } = await memFire
        .from(TABLE)
        .update({
          email,
          password_hash: createScryptHash(password),
          is_active: true
        })
        .eq('id', existingByBar[0].id)
        .select('id, email, bar_id, is_active, created_at, updated_at')
        .single()
      if (error) return json(res, 500, { ok: false, message: error.message || '保存失败' })
      return json(res, 200, { ok: true, account: data })
    }

    const { data, error } = await memFire
      .from(TABLE)
      .insert([{
        email,
        password_hash: createScryptHash(password),
        bar_id: barId,
        is_active: true
      }])
      .select('id, email, bar_id, is_active, created_at, updated_at')
      .single()
    if (error) return json(res, 500, { ok: false, message: error.message || '创建失败' })
    return json(res, 200, { ok: true, account: data })
  }

  if (action === 'reset_password') {
    const id = body.id
    const password = body.password || ''
    if (!id) return json(res, 400, { ok: false, message: '缺少账号 ID' })
    if (!validatePassword(password)) return json(res, 400, { ok: false, message: '密码长度需为 6-64 位' })

    const { error } = await memFire
      .from(TABLE)
      .update({ password_hash: createScryptHash(password) })
      .eq('id', id)
    if (error) return json(res, 500, { ok: false, message: error.message || '重置失败' })
    return json(res, 200, { ok: true })
  }

  if (action === 'set_active') {
    const id = body.id
    const isActive = body.isActive === true
    if (!id) return json(res, 400, { ok: false, message: '缺少账号 ID' })
    const { error } = await memFire
      .from(TABLE)
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) return json(res, 500, { ok: false, message: error.message || '操作失败' })
    return json(res, 200, { ok: true })
  }

  return json(res, 400, { ok: false, message: '无效操作' })
}
