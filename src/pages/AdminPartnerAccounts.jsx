import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Copy, Eye, Loader2, RefreshCw, UserPlus, X } from 'lucide-react'
import { memFire } from '../lib/memfire'
import AdminPartnerRequestQuickLinks from '../components/AdminPartnerRequestQuickLinks'
import {
  createPartnerAccount,
  generatePartnerPassword,
  listPartnerAccounts,
  resetPartnerPassword,
  setPartnerAccountActive
} from '../lib/partnerAccountService'

export default function AdminPartnerAccounts() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generatePartnerPassword())
  const [errorMsg, setErrorMsg] = useState('')
  const [credentialModal, setCredentialModal] = useState({ show: false, row: null, password: '' })
  const [logModal, setLogModal] = useState({ show: false, email: '' })
  const [logLoading, setLogLoading] = useState(false)
  const [logList, setLogList] = useState([])

  const hasHighRisk = useMemo(() => list.some((row) => Number(row.recent_failed_24h || 0) >= 5), [list])

  const fetchList = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const rows = await listPartnerAccounts()
      setList(rows)
    } catch (err) {
      setErrorMsg(err?.message || '加载失败')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')
    try {
      const created = await createPartnerAccount({ email, password })
      setCredentialModal({
        show: true,
        row: {
          ...(created || {}),
          email: created?.email || email.trim().toLowerCase(),
          bar_name: '',
          bar_cover_image_url: '',
          bar_id: null
        },
        password
      })
      setEmail('')
      setPassword(generatePartnerPassword())
      await fetchList()
      alert('商户账号已创建，可将邮箱和密码发给商户登录 partner 端')
    } catch (err) {
      setErrorMsg(err?.message || '创建失败')
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async (row) => {
    const nextPwd = generatePartnerPassword()
    try {
      await resetPartnerPassword({ id: row.id, password: nextPwd })
      await fetchList()
      setCredentialModal({ show: true, row, password: nextPwd })
    } catch (err) {
      alert(err?.message || '重置失败')
    }
  }

  const handleToggleActive = async (row) => {
    const next = !row.is_active
    const text = next ? '启用' : '停用'
    if (!window.confirm(`确认${text}商户账号 ${row.email} ?`)) return
    try {
      await setPartnerAccountActive({ id: row.id, isActive: next })
      await fetchList()
    } catch (err) {
      alert(err?.message || `${text}失败`)
    }
  }

  const openCredentialModal = (row) => {
    setCredentialModal({ show: true, row, password: '' })
  }

  const copyCredentials = async () => {
    if (!credentialModal?.row?.email) return
    if (!credentialModal.password) {
      alert('请先点击“重置并显示新密码”，再复制密码')
      return
    }
    try {
      await navigator.clipboard.writeText(credentialModal.password)
      alert('密码已复制到剪贴板')
    } catch {
      alert('复制失败，请手动复制')
    }
  }

  const openLogModal = async (row) => {
    const emailValue = (row?.email || '').trim().toLowerCase()
    if (!emailValue) return
    setLogModal({ show: true, email: emailValue })
    setLogLoading(true)
    try {
      const { data, error } = await memFire
        .from('partner_login_audit_logs')
        .select('id, status, reason, failed_count, locked_until, ip_address, user_agent, created_at')
        .eq('email', emailValue)
        .order('created_at', { ascending: false })
        .limit(120)
      if (error) throw error
      setLogList(data || [])
    } catch (err) {
      setLogList([])
      alert(err?.message || '加载登录记录失败')
    } finally {
      setLogLoading(false)
    }
  }

  const closeLogModal = () => {
    setLogModal({ show: false, email: '' })
    setLogList([])
  }

  const formatTime = (ts) => {
    if (!ts) return '--'
    const dt = new Date(ts)
    if (Number.isNaN(dt.getTime())) return '--'
    return dt.toLocaleString('zh-CN', { hour12: false })
  }

  return (
    <div className="min-h-screen bg-cc-neutral-50">
      {credentialModal.show && credentialModal.row && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={() => setCredentialModal({ show: false, row: null, password: '' })}>
          <div className="bg-cc-surface rounded-cc-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-cc-neutral-800">商户登录账号</h3>
              <button type="button" onClick={() => setCredentialModal({ show: false, row: null, password: '' })} className="text-cc-neutral-500 hover:text-cc-error">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-cc-neutral-100 rounded-cc p-3">
                {credentialModal.row.bar_cover_image_url ? (
                  <img src={credentialModal.row.bar_cover_image_url} alt="" className="w-12 h-12 rounded-cc object-cover border border-cc-border" />
                ) : (
                  <div className="w-12 h-12 rounded-cc bg-cc-neutral-200 flex items-center justify-center text-xs text-cc-neutral-500">门店</div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-cc-neutral-800 truncate">{credentialModal.row.bar_name || '未绑定门店'}</p>
                  <p className="text-xs text-cc-neutral-500 truncate">{credentialModal.row.bar_id || '暂无门店 ID'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-cc-neutral-500 mb-1">登录账号（邮箱）</p>
                <div className="bg-cc-neutral-100 rounded-cc px-3 py-2 text-sm font-semibold text-cc-neutral-800">{credentialModal.row.email}</div>
              </div>
              <div>
                <p className="text-xs font-bold text-cc-neutral-500 mb-1">登录密码</p>
                <div className="bg-cc-neutral-100 rounded-cc px-3 py-2 text-sm text-cc-neutral-800">
                  {credentialModal.password || '出于安全原因，不保存明文旧密码。请点击下方按钮重置并显示新密码。'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!credentialModal.row.id}
                  onClick={() => handleResetPassword(credentialModal.row)}
                  className="flex-1 bg-cc-neutral-900 text-white py-2.5 rounded-cc text-sm font-bold disabled:opacity-50"
                >
                  重置并显示新密码
                </button>
                <button type="button" onClick={copyCredentials} className="px-3 py-2.5 rounded-cc bg-cc-neutral-100 text-cc-neutral-700 text-sm font-bold">
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {logModal.show && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={closeLogModal}>
          <div className="bg-cc-surface rounded-cc-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-cc-neutral-800">商户登录记录 · {logModal.email}</h3>
              <button type="button" onClick={closeLogModal} className="text-cc-neutral-500 hover:text-cc-error"><X size={18} /></button>
            </div>
            {logLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-cc-primary" size={26} /></div>
            ) : logList.length === 0 ? (
              <p className="text-sm text-cc-neutral-500 py-6">暂无记录</p>
            ) : (
              <div className="space-y-2">
                {logList.map((row) => (
                  <div key={row.id} className="rounded-cc border border-cc-border bg-cc-neutral-100/70 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${row.status === 'success' ? 'bg-cc-success-bg text-cc-success' : 'bg-cc-error-bg text-cc-error'}`}>
                        {row.status === 'success' ? '成功' : '失败'}
                      </span>
                      <span className="text-xs text-cc-neutral-500">{formatTime(row.created_at)}</span>
                      <span className="text-xs text-cc-neutral-500">IP: {row.ip_address || '--'}</span>
                      {row.failed_count != null ? <span className="text-xs text-cc-neutral-500">失败计数: {row.failed_count}</span> : null}
                    </div>
                    <p className="text-xs text-cc-neutral-600 mt-1">原因: {row.reason || '--'} {row.locked_until ? `· 锁定到: ${formatTime(row.locked_until)}` : ''}</p>
                    {row.user_agent ? <p className="text-[11px] text-cc-neutral-500 mt-1 break-all">{row.user_agent}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="bg-cc-surface/80 backdrop-blur-sm border-b border-cc-border px-6 py-4 sticky top-0 z-40 flex items-center justify-between shadow-cc-sm">
        <div className="flex items-center gap-4">
          <Link to="/admin/dashboard" className="text-cc-neutral-500 hover:text-cc-primary flex items-center gap-2 font-medium">
            <ArrowLeft size={18} strokeWidth={1.5} /> CupCup管理首页
          </Link>
          <div className="h-5 w-px bg-cc-border" />
          <div className="flex items-center gap-2">
            <div className="bg-cc-success-bg text-cc-success p-2 rounded-cc"><UserPlus size={20} strokeWidth={1.5} /></div>
            <h1 className="text-lg font-semibold text-cc-neutral-800">商户账号开通</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AdminPartnerRequestQuickLinks />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-6">
          <h2 className="text-base font-bold text-cc-neutral-800 mb-1">新建商户登录账号</h2>
          <p className="text-xs text-cc-neutral-500 mb-4">用于未建店商户先登录 partner 端，后续再提交门店资料审核。</p>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-cc-neutral-500 mb-1">商户邮箱</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-cc-neutral-100 rounded-cc px-3 py-2"
                placeholder="boss@coffee.com"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-cc-neutral-500 mb-1">初始密码</label>
              <div className="flex gap-2">
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-cc-neutral-100 rounded-cc px-3 py-2 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setPassword(generatePartnerPassword())}
                  className="px-3 py-2 rounded-cc bg-cc-neutral-100 text-cc-neutral-700 text-xs font-bold"
                >
                  随机
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="md:col-span-1 bg-cc-success text-white font-bold py-2.5 rounded-cc hover:opacity-90 disabled:opacity-50"
            >
              {saving ? '创建中…' : '创建账号'}
            </button>
          </form>
          {errorMsg ? <p className="text-sm text-cc-error mt-3">{errorMsg}</p> : null}
        </section>

        <section className="bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-cc-neutral-800">已开通账号</h2>
              {hasHighRisk ? (
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full inline-flex items-center gap-1">
                  <AlertTriangle size={12} /> 存在高风险账号（24h 失败≥5）
                </span>
              ) : null}
            </div>
            <button type="button" onClick={fetchList} className="text-xs font-bold text-cc-primary flex items-center gap-1"><RefreshCw size={12} /> 刷新</button>
          </div>
          {loading ? (
            <div className="flex justify-center py-14"><Loader2 className="animate-spin text-cc-primary" size={28} /></div>
          ) : list.length === 0 ? (
            <p className="text-sm text-cc-neutral-500">暂无账号</p>
          ) : (
            <div className="space-y-2">
              {list.map((row) => (
                <div key={row.id} className="rounded-cc border border-cc-border bg-cc-neutral-100/60 px-3 py-2 flex items-center gap-3">
                  {row.bar_cover_image_url ? (
                    <img src={row.bar_cover_image_url} alt="" className="w-12 h-12 rounded-cc object-cover border border-cc-border shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-cc bg-cc-neutral-200 shrink-0 flex items-center justify-center text-xs text-cc-neutral-500">门店</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-cc-neutral-800 truncate">{row.email}</p>
                    <p className="text-xs text-cc-neutral-500 mt-0.5">
                      {row.bar_id ? `门店: ${row.bar_name || row.bar_id}` : '未绑定门店'} · {row.is_active ? '启用中' : '已停用'} · 创建于 {row.created_at ? new Date(row.created_at).toLocaleString() : '--'}
                    </p>
                    <p className={`text-xs mt-0.5 ${Number(row.recent_failed_24h || 0) >= 5 ? 'text-amber-700 font-bold' : 'text-cc-neutral-500'}`}>
                      最近登录: {row.latest_login_at ? `${formatTime(row.latest_login_at)} · ${row.latest_login_status === 'success' ? '成功' : '失败'} · IP ${row.latest_login_ip || '--'}` : '暂无'} · 24h失败: {row.recent_failed_24h || 0}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCredentialModal(row)}
                    className="px-3 py-1.5 rounded-cc bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1"
                  >
                    <Eye size={12} /> 查看账号
                  </button>
                  <button
                    type="button"
                    onClick={() => openLogModal(row)}
                    className="px-3 py-1.5 rounded-cc bg-teal-100 text-teal-700 text-xs font-bold"
                  >
                    查看记录
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetPassword(row)}
                    className="px-3 py-1.5 rounded-cc bg-cc-neutral-900 text-white text-xs font-bold"
                  >
                    重置密码
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(row)}
                    className={`px-3 py-1.5 rounded-cc text-xs font-bold ${row.is_active ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
                  >
                    {row.is_active ? '停用' : '启用'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
