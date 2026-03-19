const encoder = new TextEncoder()

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(rawPassword) {
  const value = String(rawPassword || '')
  if (!value) return ''
  if (!globalThis?.crypto?.subtle) {
    throw new Error('当前环境不支持密码哈希，请升级浏览器后重试')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(value))
  return toHex(digest)
}
