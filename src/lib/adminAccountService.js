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

export function generateAdminPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function listAdminAccounts() {
  const payload = await request('/api/admin-accounts')
  return payload.list || []
}

export async function createAdminAccount({ loginId, displayName, password }) {
  const payload = await request('/api/admin-accounts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      loginId,
      displayName,
      password
    })
  })
  return payload.account
}

export async function resetAdminPassword({ id, password }) {
  await request('/api/admin-accounts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'reset_password',
      id,
      password
    })
  })
}

export async function setAdminAccountActive({ id, isActive, currentLoginId }) {
  await request('/api/admin-accounts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'set_active',
      id,
      isActive,
      currentLoginId
    })
  })
}
