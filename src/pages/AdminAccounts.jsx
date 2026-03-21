import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCw, Shield, UserPlus } from 'lucide-react'
import { getAdminSession } from '../lib/adminSession'
import AdminPartnerRequestQuickLinks from '../components/AdminPartnerRequestQuickLinks'
import {
  createAdminAccount,
  generateAdminPassword,
  listAdminAccounts,
  resetAdminPassword,
  setAdminAccountActive
} from '../lib/adminAccountService'

export default function AdminAccounts() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loginId, setLoginId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState(generateAdminPassword())

  const session = getAdminSession()
  const currentLoginId = session?.login_id || ''

  const fetchList = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const rows = await listAdminAccounts()
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
      await createAdminAccount({ loginId, displayName, password })
      setLoginId('')
      setDisplayName('')
      setPassword(generateAdminPassword())
      await fetchList()
      alert('管理员账号已创建')
    } catch (err) {
      setErrorMsg(err?.message || '创建失败')
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async (row) => {
    const nextPwd = generateAdminPassword()
    try {
      await resetAdminPassword({ id: row.id, password: nextPwd })
      await fetchList()
      alert(`密码已重置\n账号: ${row.login_id}\n新密码: ${nextPwd}`)
    } catch (err) {
      alert(err?.message || '重置失败')
    }
  }

  const handleToggleActive = async (row) => {
    const next = !row.is_active
    const text = next ? '启用' : '停用'
    if (!window.confirm(`确认${text}管理员账号 ${row.login_id} ?`)) return
    try {
      await setAdminAccountActive({
        id: row.id,
        isActive: next,
        currentLoginId
      })
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
            <div className="bg-indigo-100 text-indigo-700 p-2 rounded-cc"><Shield size={20} strokeWidth={1.5} /></div>
            <h1 className="text-lg font-semibold text-cc-neutral-800">管理员账号管理</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AdminPartnerRequestQuickLinks />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-6">
          <h2 className="text-base font-bold text-cc-neutral-800 mb-1">新增管理员账号</h2>
          <p className="text-xs text-cc-neutral-500 mb-4">建议至少保留 2 个可用管理员账号，避免单点故障。</p>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-cc-neutral-500 mb-1">账号 ID</label>
              <input
                required
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                className="w-full bg-cc-neutral-100 rounded-cc px-3 py-2"
                placeholder="如：ops_admin"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-cc-neutral-500 mb-1">显示名</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-cc-neutral-100 rounded-cc px-3 py-2"
                placeholder="如：Ops Admin"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-cc-neutral-500 mb-1">初始密码</label>
              <div className="flex gap-2">
                <input
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-cc-neutral-100 rounded-cc px-3 py-2 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setPassword(generateAdminPassword())}
                  className="px-3 py-2 rounded-cc bg-cc-neutral-100 text-cc-neutral-700 text-xs font-bold"
                >
                  随机
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 text-white font-bold py-2.5 rounded-cc hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <UserPlus size={14} /> {saving ? '创建中…' : '创建管理员'}
            </button>
          </form>
          {errorMsg ? <p className="text-sm text-cc-error mt-3">{errorMsg}</p> : null}
        </section>

        <section className="bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-cc-neutral-800">管理员列表</h2>
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
                    <p className="text-sm font-bold text-cc-neutral-800 truncate">{row.login_id}</p>
                    <p className="text-xs text-cc-neutral-500 mt-0.5">
                      {row.display_name || 'Admin'} · {row.is_active ? '启用中' : '已停用'} · 最近登录 {row.last_login_at ? new Date(row.last_login_at).toLocaleString('zh-CN') : '暂无'}
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
