const STORAGE_KEY = 'admin_session_v1'
const FALLBACK_KEY = 'isLoggedIn'
const DEFAULT_TTL_MS = 15 * 24 * 60 * 60 * 1000

function readRawSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getAdminSession() {
  const session = readRawSession()
  if (!session?.expiresAt || Date.now() >= Number(session.expiresAt)) {
    clearAdminSession()
    return null
  }
  return session
}

export function isAdminAuthenticated() {
  return !!getAdminSession()
}

export function setAdminSession(payload, ttlMs = DEFAULT_TTL_MS) {
  if (typeof window === 'undefined') return
  const expiresAt = Date.now() + ttlMs
  const next = {
    ...payload,
    expiresAt
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  localStorage.removeItem(FALLBACK_KEY)
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(FALLBACK_KEY)
}
