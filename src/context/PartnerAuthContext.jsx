/**
 * 商户端鉴权上下文
 * 登录主源：partner_accounts（bars.owner_* 仅做兼容迁移兜底）
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { memFire } from '../lib/memfire'

export { memFire }

const STORAGE_BAR_ID = 'partner_bar_id'
const STORAGE_BAR_INFO = 'partner_bar_info'
const STORAGE_PARTNER_ACCOUNT = 'partner_account'

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
  const [partnerAccount, setPartnerAccount] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PARTNER_ACCOUNT)
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

  const persistPartnerAccount = useCallback((account) => {
    setPartnerAccount(account)
    if (account) localStorage.setItem(STORAGE_PARTNER_ACCOUNT, JSON.stringify(account))
    else localStorage.removeItem(STORAGE_PARTNER_ACCOUNT)
  }, [])

  // 商户登录：先查 partner_accounts，bars.owner_* 仅做兼容兜底
  const login = useCallback(async (email, password) => {
    const emailTrim = (email || '').trim().toLowerCase()
    if (!emailTrim || !password) throw new Error('请输入邮箱和密码')

    const { data: accounts, error: accountError } = await memFire
      .from('partner_accounts')
      .select('id, email, bar_id')
      .eq('email', emailTrim)
      .eq('password', password)
      .limit(1)
    if (accountError) throw accountError

    if (accounts?.length) {
      const account = accounts[0]
      persistPartnerAccount({ id: account.id, email: account.email, bar_id: account.bar_id || null })

      if (account.bar_id) {
        const { data: linkedBar } = await memFire
          .from('bars')
          .select('id, name, category, address, contact_phone, cover_image_url, detail_images, description')
          .eq('id', account.bar_id)
          .single()
        if (linkedBar) {
          persistBar(linkedBar.id, {
            ...linkedBar,
            category: linkedBar.category ?? '鸡尾酒吧',
            address: linkedBar.address ?? '',
            contact_phone: linkedBar.contact_phone ?? '',
            cover_image_url: linkedBar.cover_image_url ?? '',
            detail_images: Array.isArray(linkedBar.detail_images) ? linkedBar.detail_images : [],
            description: linkedBar.description ?? ''
          })
          setUser({ id: linkedBar.id })
          return linkedBar
        }
      }

      persistBar(null, null)
      setUser({ id: account.id })
      return { id: account.id, email: account.email, bar_id: account.bar_id || null }
    }

    // 兼容旧账号：bars.owner_*，命中后自动迁移到 partner_accounts
    const { data: bars, error: barsError } = await memFire
      .from('bars')
      .select('id, name, category, address, contact_phone, cover_image_url, detail_images, description, owner_email, owner_password')
      .eq('owner_email', emailTrim)
      .eq('owner_password', password)
      .limit(1)
    if (barsError) throw barsError
    if (!bars?.length) throw new Error('邮箱或密码错误，请核对后重试')

    const bar = bars[0]
    const { data: migratedAccount } = await memFire
      .from('partner_accounts')
      .upsert(
        [{ email: emailTrim, password, bar_id: bar.id }],
        { onConflict: 'email' }
      )
      .select('id, email, bar_id')
      .single()
    if (migratedAccount) {
      persistPartnerAccount({ id: migratedAccount.id, email: migratedAccount.email, bar_id: migratedAccount.bar_id || bar.id })
    }

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
  }, [persistBar, persistPartnerAccount])

  const logout = useCallback(() => {
    setUser(null)
    persistBar(null, null)
    persistPartnerAccount(null)
  }, [persistBar, persistPartnerAccount])

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
    } else if (partnerAccount?.id) {
      memFire
        .from('partner_accounts')
        .select('id, email, bar_id')
        .eq('id', partnerAccount.id)
        .single()
        .then(({ data }) => {
          if (!cancelled && data) {
            persistPartnerAccount({ id: data.id, email: data.email, bar_id: data.bar_id || null })
            setUser({ id: data.id })
          }
        })
        .catch(() => {})
    }
    setLoading(false)
    return () => { cancelled = true }
  }, [barId, partnerAccount?.id, persistBar, persistPartnerAccount])

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
    partnerAccount,
    loading,
    login,
    logout,
    refreshBarInfo,
    isPartnerLoggedIn: !!(barId || partnerAccount?.id)
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
