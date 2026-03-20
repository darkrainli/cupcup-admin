import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCw, Shield, UserPlus } from 'lucide-react'
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
      await createPartnerAccount({ email, password })
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
      alert(`密码已重置\n邮箱: ${row.email}\n新密码: ${nextPwd}`)
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

  return (
    <div className="min-h-screen bg-cc-neutral-50">
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
        <Link
          to="/admin/partner-login-audit"
          className="text-xs font-bold text-teal-700 hover:opacity-90 bg-teal-100 px-3 py-1.5 rounded-full flex items-center gap-1.5"
        >
          <Shield size={12} /> 商户登录审计
        </Link>
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
            <h2 className="text-base font-bold text-cc-neutral-800">已开通账号</h2>
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
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-cc-neutral-800 truncate">{row.email}</p>
                    <p className="text-xs text-cc-neutral-500 mt-0.5">
                      {row.bar_id ? `已绑定门店: ${row.bar_id}` : '未绑定门店'} · {row.is_active ? '启用中' : '已停用'} · 创建于 {row.created_at ? new Date(row.created_at).toLocaleString() : '--'}
                    </p>
                  </div>
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
