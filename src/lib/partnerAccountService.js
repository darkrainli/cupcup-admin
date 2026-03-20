const API_PATH = '/api/partner-accounts'

function createError(message) {
  return new Error(message || '请求失败')
}

async function request(path, options = {}) {
  const response = await fetch(path, options)
  let payload = {}
  try {
    payload = await response.json()
  } catch {
    payload = {}
  }
  if (!response.ok || payload?.ok === false) {
    throw createError(payload?.message || '请求失败')
  }
  return payload
}

export function generatePartnerPassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function listPartnerAccounts() {
  const payload = await request(API_PATH)
  return payload.list || []
}

export async function getPartnerAccountByBarId(barId) {
  if (!barId) return null
  const list = await listPartnerAccounts()
  return list.find((row) => row.bar_id === barId) || null
}

export async function createPartnerAccount({ email, password }) {
  const payload = await request(API_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      email,
      password
    })
  })
  return payload.account
}

export async function upsertPartnerAccountForBar({ barId, email, password }) {
  const payload = await request(API_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'upsert_for_bar',
      barId,
      email,
      password
    })
  })
  return payload.account
}

export async function resetPartnerPassword({ id, password }) {
  await request(API_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'reset_password',
      id,
      password
    })
  })
}

export async function setPartnerAccountActive({ id, isActive }) {
  await request(API_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'set_active',
      id,
      isActive
    })
  })
}
