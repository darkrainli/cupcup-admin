function createAuthError(message, code) {
  const err = new Error(message)
  if (code) err.code = code
  return err
}

export async function loginAdmin({ loginId, password, context = {} }) {
  const id = (loginId || '').trim()
  if (!id || !password) throw createAuthError('请输入管理员账号和密码', 'INVALID_INPUT')

  const response = await fetch('/api/admin-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      loginId: id,
      password,
      userAgent: context?.userAgent || ''
    })
  })

  let payload = {}
  try {
    payload = await response.json()
  } catch {
    payload = {}
  }

  if (!response.ok || !payload?.ok) {
    const msg = payload?.message || '登录失败，请稍后重试'
    throw createAuthError(msg, payload?.code || 'LOGIN_FAILED')
  }

  const account = payload?.account
  if (!account?.id || !account?.login_id) {
    throw createAuthError('登录返回异常，请稍后重试', 'INVALID_RESPONSE')
  }

  return {
    id: account.id,
    login_id: account.login_id,
    display_name: account.display_name || 'Admin'
  }
}
