/**
 * 商户端鉴权上下文
 * 登录：用邮箱+密码与 bars 表的 owner_email / owner_password 校验，通过则缓存 bar_id / barInfo
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { memFire } from '../lib/memfire'

export { memFire }

const STORAGE_BAR_ID = 'partner_bar_id'
const STORAGE_BAR_INFO = 'partner_bar_info'

const PartnerAuthContext = createContext(null)

export function PartnerAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [barId, setBarId] = useState(() => localStorage.getItem(STORAGE_BAR_ID))
  const [barInfo, setBarInfo] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_BAR_INFO)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  // 持久化 bar_id / barInfo
  const persistBar = useCallback((id, info) => {
    setBarId(id)
    setBarInfo(info)
    if (id) localStorage.setItem(STORAGE_BAR_ID, id)
    else localStorage.removeItem(STORAGE_BAR_ID)
    if (info) localStorage.setItem(STORAGE_BAR_INFO, JSON.stringify(info))
    else localStorage.removeItem(STORAGE_BAR_INFO)
  }, [])

  // 商户登录：用邮箱+密码与 bars 表的 owner_email、owner_password 校验，通过则缓存 bar_id
  const login = useCallback(async (email, password) => {
    const emailTrim = (email || '').trim().toLowerCase()
    if (!emailTrim || !password) throw new Error('请输入邮箱和密码')

    const { data: bars, error: barsError } = await memFire
      .from('bars')
      .select('id, name, category, address, contact_phone, cover_image_url, detail_images, description')
      .eq('owner_email', emailTrim)
      .eq('owner_password', password)
      .limit(1)

    if (barsError) throw barsError
    if (!bars?.length) throw new Error('邮箱或密码错误，请核对后重试')

    const bar = bars[0]
    persistBar(bar.id, {
      id: bar.id,
      name: bar.name,
      category: bar.category ?? '鸡尾酒吧',
      address: bar.address ?? '',
      contact_phone: bar.contact_phone ?? '',
      cover_image_url: bar.cover_image_url ?? '',
      detail_images: Array.isArray(bar.detail_images) ? bar.detail_images : [],
      description: bar.description ?? ''
    })
    setUser({ id: bar.id })
    return bar
  }, [persistBar])

  const logout = useCallback(() => {
    setUser(null)
    persistBar(null, null)
  }, [persistBar])

  // 初始化：若有缓存的 bar_id 则仅刷新 bar 信息，登录态以 bars 表校验为准（无 Auth session 依赖）
  useEffect(() => {
    let cancelled = false
    if (barId) {
      memFire.from('bars').select('id, name, category, address, contact_phone, cover_image_url, detail_images, description').eq('id', barId).single()
        .then(({ data }) => {
          if (!cancelled && data) {
            persistBar(data.id, {
              ...data,
              category: data.category ?? '鸡尾酒吧',
              address: data.address ?? '',
              contact_phone: data.contact_phone ?? '',
              cover_image_url: data.cover_image_url ?? '',
              detail_images: Array.isArray(data.detail_images) ? data.detail_images : [],
              description: data.description ?? ''
            })
          }
        })
        .catch(() => {})
    }
    setLoading(false)
    return () => { cancelled = true }
  }, [barId, persistBar])

  const refreshBarInfo = useCallback(async () => {
    if (!barId) return
    const { data, error } = await memFire
      .from('bars')
      .select('id, name, category, address, contact_phone, cover_image_url, detail_images, description')
      .eq('id', barId)
      .single()
    if (!error && data) {
      const info = {
        ...data,
        category: data.category ?? '鸡尾酒吧',
        address: data.address ?? '',
        contact_phone: data.contact_phone ?? '',
        cover_image_url: data.cover_image_url ?? '',
        detail_images: Array.isArray(data.detail_images) ? data.detail_images : [],
        description: data.description ?? ''
      }
      setBarInfo(info)
      localStorage.setItem(STORAGE_BAR_INFO, JSON.stringify(info))
    }
  }, [barId])

  const value = {
    user,
    barId,
    barInfo,
    loading,
    login,
    logout,
    refreshBarInfo,
    isPartnerLoggedIn: !!barId
  }

  return (
    <PartnerAuthContext.Provider value={value}>
      {children}
    </PartnerAuthContext.Provider>
  )
}

export function usePartnerAuth() {
  const ctx = useContext(PartnerAuthContext)
  if (!ctx) throw new Error('usePartnerAuth must be used within PartnerAuthProvider')
  return ctx
}
