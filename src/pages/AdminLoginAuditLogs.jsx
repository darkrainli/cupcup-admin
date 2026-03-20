import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Shield, Search } from 'lucide-react'
import { memFire } from '../lib/memfire'

const STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failure' }
]

const REASON_LABELS = {
  login_success: '登录成功',
  invalid_credentials: '账号或密码错误',
  invalid_credentials_lock: '连续错误触发锁定',
  account_locked: '账号处于锁定期',
  account_disabled: '账号停用',
  password_hash_missing: '未配置密码哈希'
}
const PAGE_SIZE = 50

function formatTime(ts) {
  if (!ts) return '-'
  const dt = new Date(ts)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleString('zh-CN', { hour12: false })
}

function escapeCsv(value) {
  const raw = value == null ? '' : String(value)
  const escaped = raw.replace(/"/g, '""')
  return `"${escaped}"`
}

export default function AdminLoginAuditLogs() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('all')
  const [loginId, setLoginId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      let query = memFire
        .from('admin_login_audit_logs')
        .select('id, login_id, status, reason, failed_count, locked_until, ip_address, user_agent, created_at')
        .order('created_at', { ascending: false })
        .limit(300)

      if (status !== 'all') query = query.eq('status', status)
      if (loginId.trim()) query = query.ilike('login_id', `%${loginId.trim().toLowerCase()}%`)
      if (dateFrom) query = query.gte('created_at', new Date(`${dateFrom}T00:00:00`).toISOString())
      if (dateTo) query = query.lte('created_at', new Date(`${dateTo}T23:59:59`).toISOString())

      const { data, error: queryError } = await query
      if (queryError) {
        const msg = queryError.message || ''
        if (msg.includes('relation') && msg.includes('does not exist')) {
          throw new Error('缺少登录审计日志表，请先执行 sql/admin_login_security_audit.sql')
        }
        throw queryError
      }

      setList(data || [])
      setPage(1)
    } catch (err) {
      console.error('fetch admin login audit logs failed:', err)
      setList([])
      setError(err?.message || '加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageList = list.slice(startIndex, startIndex + PAGE_SIZE)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const exportCsv = () => {
    if (!list.length) return
    const headers = ['时间', '账号', '状态', '原因', '失败计数', '锁定到', 'IP', '终端信息']
    const rows = list.map((row) => ([
      formatTime(row.created_at),
      row.login_id || '',
      row.status === 'success' ? '成功' : '失败',
      REASON_LABELS[row.reason] || row.reason || '',
      row.failed_count ?? '',
      formatTime(row.locked_until),
      row.ip_address || '',
      row.user_agent || ''
    ]))
    const csvContent = [headers, ...rows]
      .map((line) => line.map(escapeCsv).join(','))
      .join('\n')
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin-login-audit-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
            <div className="bg-sky-100 text-sky-700 p-2 rounded-cc"><Shield size={20} strokeWidth={1.5} /></div>
            <h1 className="text-lg font-semibold text-cc-neutral-800">管理员登录审计</h1>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-cc-surface border border-cc-border rounded-cc-xl p-5 shadow-sm mb-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-cc-neutral-500 mb-1">管理员账号</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cc-neutral-400" />
                <input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="支持模糊搜索"
                  className="w-full bg-cc-neutral-100 border border-cc-border rounded-cc pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cc-primary/20 focus:border-cc-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-cc-neutral-500 mb-1">状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-cc-neutral-100 border border-cc-border rounded-cc px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cc-primary/20 focus:border-cc-primary"
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-cc-neutral-500 mb-1">开始日期</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-cc-neutral-100 border border-cc-border rounded-cc px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cc-primary/20 focus:border-cc-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-cc-neutral-500 mb-1">结束日期</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-cc-neutral-100 border border-cc-border rounded-cc px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cc-primary/20 focus:border-cc-primary"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="bg-cc-primary text-white px-4 py-2 rounded-cc font-bold text-sm hover:bg-cc-primary-hover disabled:opacity-60"
            >
              {loading ? '查询中…' : '查询日志'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus('all')
                setLoginId('')
                setDateFrom('')
                setDateTo('')
                setPage(1)
              }}
              className="bg-cc-neutral-100 text-cc-neutral-600 px-4 py-2 rounded-cc font-bold text-sm hover:bg-cc-neutral-200"
            >
              重置筛选
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || list.length === 0}
              className="bg-sky-100 text-sky-700 px-4 py-2 rounded-cc font-bold text-sm hover:bg-sky-200 disabled:opacity-50"
            >
              导出 CSV
            </button>
            <p className="text-xs text-cc-neutral-500">默认展示最近 300 条记录</p>
          </div>
          {error ? <p className="text-sm text-cc-error mt-3">{error}</p> : null}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-cc-primary" size={36} /></div>
        ) : list.length === 0 ? (
          <div className="bg-cc-surface border border-dashed border-cc-border rounded-cc-xl p-14 text-center text-cc-neutral-500 font-bold">
            暂无匹配的登录审计日志
          </div>
        ) : (
          <div className="bg-cc-surface border border-cc-border rounded-cc-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-cc-neutral-100">
                  <tr className="text-left text-cc-neutral-600">
                    <th className="px-4 py-3 font-bold">时间</th>
                    <th className="px-4 py-3 font-bold">账号</th>
                    <th className="px-4 py-3 font-bold">状态</th>
                    <th className="px-4 py-3 font-bold">原因</th>
                    <th className="px-4 py-3 font-bold">失败计数</th>
                    <th className="px-4 py-3 font-bold">锁定到</th>
                    <th className="px-4 py-3 font-bold">IP</th>
                    <th className="px-4 py-3 font-bold">终端信息</th>
                  </tr>
                </thead>
                <tbody>
                  {pageList.map((row) => (
                    <tr key={row.id} className="border-t border-cc-border align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-cc-neutral-700">{formatTime(row.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-cc-neutral-800">{row.login_id || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${row.status === 'success' ? 'bg-cc-success-bg text-cc-success' : 'bg-cc-error-bg text-cc-error'}`}>
                          {row.status === 'success' ? '成功' : '失败'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-cc-neutral-700">{REASON_LABELS[row.reason] || row.reason || '-'}</td>
                      <td className="px-4 py-3 text-cc-neutral-700">{row.failed_count ?? '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-cc-neutral-700">{formatTime(row.locked_until)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-cc-neutral-700">{row.ip_address || '-'}</td>
                      <td className="px-4 py-3 text-xs text-cc-neutral-500 max-w-[360px]">
                        {row.user_agent ? <p className="break-words">{row.user_agent}</p> : <p>-</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-cc-border px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-cc-neutral-500">
                共 {list.length} 条，第 {safePage}/{totalPages} 页（每页 {PAGE_SIZE} 条）
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="bg-cc-neutral-100 text-cc-neutral-600 px-3 py-1.5 rounded-cc text-xs font-bold hover:bg-cc-neutral-200 disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="bg-cc-neutral-100 text-cc-neutral-600 px-3 py-1.5 rounded-cc text-xs font-bold hover:bg-cc-neutral-200 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
