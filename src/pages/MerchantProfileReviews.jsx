import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, Loader2, X, XCircle } from 'lucide-react'
import {
  approveMerchantProfileRequest,
  getBarById,
  listMerchantProfileRequests,
  rejectMerchantProfileRequest
} from '../lib/merchantProfileReviewService'

const FILTERS = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已驳回' }
]

function statusText(status) {
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '已驳回'
  return '待审核'
}

export default function MerchantProfileReviews() {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [barInfo, setBarInfo] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const fetchList = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const rows = await listMerchantProfileRequests(statusFilter)
      setList(rows)
    } catch (err) {
      setErrorMsg(err?.message || '加载失败')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const openDetail = useCallback(async (row) => {
    setDetail(row)
    setBarInfo(null)
    setRejectReason(row?.review_comment || '')
    setErrorMsg('')
    try {
      const bar = await getBarById(row.bar_id)
      setBarInfo(bar)
      setEditForm({
        name: row?.payload?.name || bar?.name || '',
        category: row?.payload?.category || bar?.category || '',
        address: row?.payload?.address || bar?.address || '',
        contact_phone: row?.payload?.contact_phone || bar?.contact_phone || '',
        description: row?.payload?.description || bar?.description || '',
        cover_image_url: row?.payload?.cover_image_url || bar?.cover_image_url || '',
        latitude: String(bar?.latitude ?? ''),
        longitude: String(bar?.longitude ?? '')
      })
    } catch (err) {
      setErrorMsg(err?.message || '读取门店详情失败')
    }
  }, [])

  const oldData = useMemo(() => {
    if (!barInfo) return null
    return {
      name: barInfo?.name || '',
      category: barInfo?.category || '',
      address: barInfo?.address || '',
      contact_phone: barInfo?.contact_phone || '',
      description: barInfo?.description || '',
      cover_image_url: barInfo?.cover_image_url || '',
      latitude: String(barInfo?.latitude ?? ''),
      longitude: String(barInfo?.longitude ?? '')
    }
  }, [barInfo])

  const handleApprove = useCallback(async () => {
    if (!detail || !editForm) return
    setSaving(true)
    setErrorMsg('')
    try {
      await approveMerchantProfileRequest({
        request: detail,
        appliedBarData: editForm
      })
      setDetail(null)
      setBarInfo(null)
      setEditForm(null)
      await fetchList()
      alert('审核通过，门店信息已更新')
    } catch (err) {
      setErrorMsg(err?.message || '审核通过失败')
    } finally {
      setSaving(false)
    }
  }, [detail, editForm, fetchList])

  const handleReject = useCallback(async () => {
    if (!detail) return
    setSaving(true)
    setErrorMsg('')
    try {
      await rejectMerchantProfileRequest({
        requestId: detail.id,
        reason: rejectReason
      })
      setDetail(null)
      setBarInfo(null)
      setEditForm(null)
      setRejectReason('')
      await fetchList()
      alert('已驳回，商户可根据原因重新提交')
    } catch (err) {
      setErrorMsg(err?.message || '驳回失败')
    } finally {
      setSaving(false)
    }
  }, [detail, rejectReason, fetchList])

  return (
    <div className="min-h-screen bg-cc-neutral-50">
      <nav className="bg-cc-surface/80 backdrop-blur-sm border-b border-cc-border px-6 py-4 sticky top-0 z-40 flex items-center justify-between shadow-cc-sm">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-cc-neutral-500 hover:text-cc-primary flex items-center gap-2 font-medium">
            <ArrowLeft size={18} strokeWidth={1.5} /> 门店管理
          </Link>
          <div className="h-5 w-px bg-cc-border" />
          <div className="flex items-center gap-2">
            <div className="bg-cc-warning/10 text-cc-warning p-2 rounded-cc"><FileText size={20} strokeWidth={1.5} /></div>
            <h1 className="text-lg font-semibold text-cc-neutral-800">商户审核</h1>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          {FILTERS.map(f => (
            <button
              key={f.key || 'all'}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusFilter === f.key ? 'bg-cc-primary text-white' : 'bg-cc-neutral-100 text-cc-neutral-600'}`}
            >
              {f.label}
            </button>
          ))}
          <button type="button" onClick={fetchList} className="ml-auto text-xs font-bold text-cc-primary">刷新</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cc-primary" size={40} /></div>
        ) : list.length === 0 ? (
          <div className="bg-cc-surface rounded-cc-xl p-16 text-center border border-dashed border-cc-border text-cc-neutral-500 font-bold">
            暂无审核单
          </div>
        ) : (
          <ul className="space-y-4">
            {list.map((row) => (
              <li key={row.id} className="bg-cc-surface rounded-cc-xl border border-cc-border p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-cc-neutral-800 truncate">{row?.payload?.name || '未命名门店'}</p>
                    <p className="text-xs text-cc-neutral-500 mt-1 truncate">bar_id: {row.bar_id}</p>
                    <p className="text-xs text-cc-neutral-500 mt-1">提交时间：{row.created_at ? new Date(row.created_at).toLocaleString() : '--'}</p>
                    <span className={`inline-flex items-center gap-1 mt-2 text-xs font-bold px-2 py-0.5 rounded-lg ${
                      row.status === 'approved' ? 'bg-cc-success-bg text-cc-success' : row.status === 'rejected' ? 'bg-cc-error-bg text-cc-error' : 'bg-cc-warning-bg text-cc-warning'
                    }`}>
                      {row.status === 'approved' && <CheckCircle2 size={12} />}
                      {row.status === 'rejected' && <XCircle size={12} />}
                      {statusText(row.status)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openDetail(row)}
                    className="bg-cc-primary text-white px-4 py-2 rounded-cc font-bold text-sm hover:bg-cc-primary-hover"
                  >
                    查看 / 审核
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detail && editForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={() => !saving && setDetail(null)}>
          <div className="bg-cc-surface rounded-cc-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-cc-neutral-800">商户资料审核</h2>
              <button type="button" onClick={() => setDetail(null)} className="text-cc-neutral-500 hover:text-cc-error p-1"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['门店名称', 'name'],
                ['店面分类', 'category'],
                ['详细地址', 'address'],
                ['联系电话', 'contact_phone'],
                ['北纬', 'latitude'],
                ['东经', 'longitude'],
                ['封面图 URL', 'cover_image_url'],
                ['门店描述', 'description']
              ].map(([label, key]) => (
                <div key={key} className={key === 'description' || key === 'cover_image_url' || key === 'address' ? 'md:col-span-2' : ''}>
                  <label className="block text-xs font-bold text-cc-neutral-500 mb-1">{label}</label>
                  <input
                    value={editForm[key] ?? ''}
                    onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full bg-cc-neutral-100 rounded-cc px-3 py-2 text-sm"
                  />
                  <p className="text-[11px] text-cc-neutral-400 mt-1">当前生效值：{oldData?.[key] ? String(oldData[key]) : '—'}</p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold text-cc-neutral-500 mb-1">驳回原因（驳回时必填）</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full bg-cc-neutral-100 rounded-xl px-3 py-2 text-sm resize-none"
                placeholder="请填写驳回原因，商户会看到这段内容"
              />
            </div>

            {errorMsg ? <p className="text-sm text-cc-error mt-3">{errorMsg}</p> : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={saving}
                className="flex-1 bg-cc-neutral-100 text-cc-neutral-700 font-bold py-3 rounded-cc hover:bg-slate-200 disabled:opacity-50"
              >
                {saving ? '处理中…' : '驳回'}
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={saving}
                className="flex-1 bg-cc-primary text-white font-bold py-3 rounded-cc hover:bg-cc-primary-hover disabled:opacity-50"
              >
                {saving ? '处理中…' : '通过审核'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
