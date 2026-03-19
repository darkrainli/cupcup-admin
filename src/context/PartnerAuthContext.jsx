/**
 * 商户端鉴权上下文
 * 登录唯一来源：partner_accounts
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { memFire } from '../lib/memfire'

export { memFire }

const STORAGE_BAR_ID = 'partner_bar_id'
const STORAGE_BAR_INFO = 'partner_bar_info'
const STORAGE_PARTNER_ACCOUNT = 'partner_account'
const STORAGE_BAR_REMOVED_BY_ADMIN = 'partner_bar_removed_by_admin'

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
  const [barRemovedByAdmin, setBarRemovedByAdmin] = useState(() => localStorage.getItem(STORAGE_BAR_REMOVED_BY_ADMIN) === 'true')

  const normalizeBarInfo = useCallback((data) => ({
    ...data,
    category: data?.category ?? '鸡尾酒吧',
    address: data?.address ?? '',
    contact_phone: data?.contact_phone ?? '',
    cover_image_url: data?.cover_image_url ?? '',
    detail_images: Array.isArray(data?.detail_images) ? data.detail_images : [],
    description: data?.description ?? ''
  }), [])

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

  const persistBarRemovedByAdmin = useCallback((value) => {
    setBarRemovedByAdmin(Boolean(value))
    if (value) localStorage.setItem(STORAGE_BAR_REMOVED_BY_ADMIN, 'true')
    else localStorage.removeItem(STORAGE_BAR_REMOVED_BY_ADMIN)
  }, [])

  // 商户登录：仅查 partner_accounts
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
          persistBar(linkedBar.id, normalizeBarInfo(linkedBar))
          persistBarRemovedByAdmin(false)
          setUser({ id: linkedBar.id })
          return linkedBar
        }

        // 账号绑定的门店已被删除：清理绑定并打标，提示商户重新创建门店资料
        await memFire.from('partner_accounts').update({ bar_id: null }).eq('id', account.id)
        persistBarRemovedByAdmin(true)
      }

      persistBar(null, null)
      setUser({ id: account.id })
      return { id: account.id, email: account.email, bar_id: account.bar_id || null }
    }

    throw new Error('邮箱或密码错误，请核对后重试')
  }, [persistBar, persistPartnerAccount, normalizeBarInfo])

  const logout = useCallback(() => {
    setUser(null)
    persistBar(null, null)
    persistPartnerAccount(null)
    persistBarRemovedByAdmin(false)
  }, [persistBar, persistPartnerAccount, persistBarRemovedByAdmin])

  const refreshPartnerSession = useCallback(async () => {
    if (!partnerAccount?.id) return
    const { data, error } = await memFire
      .from('partner_accounts')
      .select('id, email, bar_id')
      .eq('id', partnerAccount.id)
      .single()
    if (error || !data) return

    persistPartnerAccount({ id: data.id, email: data.email, bar_id: data.bar_id || null })
    setUser({ id: data.bar_id || data.id })

    if (!data.bar_id) {
      if (barId) persistBar(null, null)
      return
    }

    const { data: linkedBar } = await memFire
      .from('bars')
      .select('id, name, category, address, contact_phone, cover_image_url, detail_images, description')
      .eq('id', data.bar_id)
      .single()
    if (linkedBar) {
      persistBar(linkedBar.id, normalizeBarInfo(linkedBar))
      persistBarRemovedByAdmin(false)
    } else {
      // 账号绑定了不存在的门店 ID（脏数据），自动降级为未绑定状态，避免后续外键报错
      await memFire.from('partner_accounts').update({ bar_id: null }).eq('id', data.id)
      persistBar(null, null)
      persistBarRemovedByAdmin(true)
    }
  }, [partnerAccount?.id, barId, persistBar, persistPartnerAccount, normalizeBarInfo, persistBarRemovedByAdmin])

  // 初始化：若有缓存的 bar_id 则刷新 bar 信息；若仅有商户账号则同步绑定状态
  useEffect(() => {
    let cancelled = false
    if (barId) {
      memFire.from('bars').select('id, name, category, address, contact_phone, cover_image_url, detail_images, description').eq('id', barId).single()
        .then(({ data }) => {
          if (!cancelled && data) {
            persistBar(data.id, normalizeBarInfo(data))
          }
        })
        .catch(() => {})
    } else if (partnerAccount?.id) {
      refreshPartnerSession().catch(() => {})
    }
    setLoading(false)
    return () => { cancelled = true }
  }, [barId, partnerAccount?.id, persistBar, normalizeBarInfo, refreshPartnerSession])

  // 未绑定门店时自动轮询绑定结果，审核通过后无需重新登录即可回显资料
  useEffect(() => {
    if (!partnerAccount?.id || barId) return undefined
    const timer = setInterval(() => {
      refreshPartnerSession().catch(() => {})
    }, 10000)
    return () => clearInterval(timer)
  }, [partnerAccount?.id, barId, refreshPartnerSession])

  const refreshBarInfo = useCallback(async () => {
    if (!barId) return
    const { data, error } = await memFire
      .from('bars')
      .select('id, name, category, address, contact_phone, cover_image_url, detail_images, description')
      .eq('id', barId)
      .single()
    if (!error && data) {
      const info = normalizeBarInfo(data)
      setBarInfo(info)
      localStorage.setItem(STORAGE_BAR_INFO, JSON.stringify(info))
    }
  }, [barId, normalizeBarInfo])

  const value = {
    user,
    barId,
    barInfo,
    barRemovedByAdmin,
    partnerAccount,
    loading,
    login,
    logout,
    refreshBarInfo,
    refreshPartnerSession,
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
