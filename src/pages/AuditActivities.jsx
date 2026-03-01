/**
 * 管理员审核页：列表展示所有商户活动（待审核+已审核），详情弹窗可编辑，封面图完整显示，提供通过/驳回；已通过活动展示发卡名单
 */
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { Loader2, CheckCircle2, XCircle, ArrowLeft, FileText, Calendar, X, AlertCircle, Users } from 'lucide-react'

const MEMFIRE_URL = import.meta.env.VITE_MEMFIRE_URL || 'https://d647ojgg91hgk1gnpfqg.baseapi.memfiredb.com'
const MEMFIRE_ANON_KEY = import.meta.env.VITE_MEMFIRE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImV4cCI6MzM0NzM1MjM5OCwiaWF0IjoxNzcwNTUyMzk4LCJpc3MiOiJzdXBhYmFzZSJ9.jWRdDqRdG9hx0UCDtHdM6xmUmmALuxFaQoaaLbIpmmU'
const memFire = createClient(MEMFIRE_URL, MEMFIRE_ANON_KEY)

export default function AuditActivities() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [detailForm, setDetailForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [participantsList, setParticipantsList] = useState([])
  const [loadingParticipants, setLoadingParticipants] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    const { data, error } = await memFire
      .from('bar_events')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error(error)
      setList([])
    } else {
      setList(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchRecipients = useCallback(async (eventId) => {
    if (!eventId) return
    setLoadingParticipants(true)
    const { data, error } = await memFire
      .from('v_event_ssr_recipients')
      .select('*')
      .eq('event_id', eventId)
      .order('card_created_at', { ascending: false })
    if (error) {
      console.error('fetch recipients', error)
      setParticipantsList([])
    } else {
      setParticipantsList(data || [])
    }
    setLoadingParticipants(false)
  }, [])

  const openDetail = (row) => {
    setDetail(row)
    if (row?.status === 'approved' && row?.id) fetchRecipients(row.id)
    else setParticipantsList([])
    setDetailForm({
      title: row.title ?? '',
      content: row.content ?? '',
      address: row.address ?? '',
      contact_phone: row.contact_phone ?? '',
      target_black_card_count: row.target_black_card_count ?? 5,
      max_participants: row.max_participants ?? 0,
      start_time: row.start_time ? row.start_time.slice(0, 16) : '',
      end_time: row.end_time ? row.end_time.slice(0, 16) : ''
    })
  }

  const openRejectModal = () => {
    setRejectReason('')
    setRejectModal(true)
  }

  const updateDetail = async (newStatus, rejectReasonText) => {
    if (!detail?.id) return
    if (newStatus === 'rejected') {
      const trimmed = (rejectReasonText ?? rejectReason).trim()
      if (!trimmed) {
        alert('请填写驳回理由，方便商户修改后重新提交。')
        return
      }
      setRejectModal(false)
      setRejectReason('')
    }
    setSaving(true)
    const payload = {
      ...(detailForm && {
        title: detailForm.title?.slice(0, 24),
        content: detailForm.content?.slice(0, 500),
        address: detailForm.address,
        contact_phone: detailForm.contact_phone,
        target_black_card_count: Math.min(15, Math.max(3, Number(detailForm.target_black_card_count) || 5)),
        max_participants: Math.max(0, Number(detailForm.max_participants) || 0),
        start_time: detailForm.start_time ? new Date(detailForm.start_time).toISOString() : detail.start_time,
        end_time: detailForm.end_time ? new Date(detailForm.end_time).toISOString() : detail.end_time
      }),
      status: newStatus,
      ...(newStatus === 'rejected' && { reject_reason: (rejectReasonText ?? rejectReason).trim() })
    }
    const { error } = await memFire.from('bar_events').update(payload).eq('id', detail.id)
    setSaving(false)
    if (error) {
      alert('操作失败：' + (error.message || '未知错误'))
      return
    }
    setDetail(null)
    setDetailForm(null)
    fetchAll()
    if (newStatus === 'approved') alert('已通过审核，系统将按规则向黑卡用户发卡。')
    else alert('已驳回，商户将看到您填写的驳回理由。')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-6 py-4 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-500 hover:text-indigo-600 flex items-center gap-2 font-bold">
            <ArrowLeft size={20} /> 门店管理
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 p-2 rounded-xl text-white"><FileText size={22} /></div>
            <h1 className="text-xl font-black text-slate-800">活动审核</h1>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <p className="text-slate-500 text-sm font-semibold mb-6">全部商户活动（待审核与已审核，通过后将向黑卡用户下发 CupSSR）</p>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-dashed border-slate-200 text-slate-400 font-bold">
            暂无活动
          </div>
        ) : (
          <ul className="space-y-4">
            {list.map((row) => (
              <li key={row.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {row.cover_image_url ? (
                    <img src={row.cover_image_url} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-100 shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-slate-100 shrink-0 flex items-center justify-center text-slate-400 text-xs">无封面</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-800 truncate">{row.title || '未命名活动'}</h3>
                    <p className="text-sm text-slate-500 mt-1">{row.bar_name}</p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Calendar size={12} /> {row.start_time ? new Date(row.start_time).toLocaleString('zh-CN') : '-'} ～ {row.end_time ? new Date(row.end_time).toLocaleString('zh-CN') : '-'}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 mt-2 text-xs font-bold px-2 py-0.5 rounded-lg ${
                        row.status === 'approved' ? 'bg-green-100 text-green-700' : row.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {row.status === 'approved' && <CheckCircle2 size={12} />}
                      {row.status === 'rejected' && <XCircle size={12} />}
                      {row.status === 'pending' && <AlertCircle size={12} />}
                      {row.status === 'approved' ? '已发布' : row.status === 'rejected' ? '已驳回' : '待审核'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openDetail(row)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700"
                  >
                    查看 / 审核
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 详情弹窗：可编辑 + 通过/驳回 */}
      {detail && detailForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={() => !saving && setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-slate-800">活动详情 · 审核</h2>
              <button type="button" onClick={() => setDetail(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={20} /></button>
            </div>
            {detail.cover_image_url && (
              <div className="mb-6">
                <span className="block text-xs font-bold text-slate-500 mb-2">活动封面图（完整尺寸）</span>
                <img src={detail.cover_image_url} alt="" className="w-full rounded-xl border border-slate-200 object-contain max-h-[70vh]" />
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">标题</label>
                <input
                  value={detailForm.title}
                  onChange={e => setDetailForm({ ...detailForm, title: e.target.value })}
                  maxLength={24}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm"
                />
                <span className="text-xs text-slate-400">{detailForm.title.length}/24</span>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">详情</label>
                <textarea
                  value={detailForm.content}
                  onChange={e => setDetailForm({ ...detailForm, content: e.target.value })}
                  maxLength={500}
                  rows={4}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm resize-none"
                />
                <span className="text-xs text-slate-400">{detailForm.content.length}/500</span>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">黑卡数量</label>
                <input
                  type="number"
                  min={3}
                  max={15}
                  value={detailForm.target_black_card_count}
                  onChange={e => setDetailForm({ ...detailForm, target_black_card_count: e.target.value })}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">活动名额限制（邀请人数，人）</label>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={detailForm.max_participants}
                  onChange={e => setDetailForm({ ...detailForm, max_participants: e.target.value })}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm"
                />
                {detail?.actual_verified_count != null && (
                  <p className="text-xs text-slate-500 mt-1">已核销：{detail.actual_verified_count} 人</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">开始时间</label>
                <input
                  type="datetime-local"
                  value={detailForm.start_time}
                  onChange={e => setDetailForm({ ...detailForm, start_time: e.target.value })}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">结束时间</label>
                <input
                  type="datetime-local"
                  value={detailForm.end_time}
                  onChange={e => setDetailForm({ ...detailForm, end_time: e.target.value })}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">地址</label>
                <input
                  value={detailForm.address}
                  onChange={e => setDetailForm({ ...detailForm, address: e.target.value })}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">联系电话</label>
                <input
                  value={detailForm.contact_phone}
                  onChange={e => setDetailForm({ ...detailForm, contact_phone: e.target.value })}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* 发卡名单：仅已通过审核的活动展示 */}
            {detail?.status === 'approved' && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                  <Users size={16} /> 发卡名单（{participantsList.length} 人）
                </h3>
                {loadingParticipants ? (
                  <div className="flex justify-center py-6"><Loader2 className="animate-spin text-indigo-500" size={24} /></div>
                ) : participantsList.length === 0 ? (
                  <p className="text-sm text-slate-400">暂无发卡记录</p>
                ) : (
                  <div className="overflow-x-auto max-h-48 overflow-y-auto rounded-xl border border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">昵称</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">CupID</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">核销码</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">状态</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">发卡时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participantsList.map((r) => (
                          <tr key={r.card_id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-800">{r.profile_username || '-'}</td>
                            <td className="px-3 py-2 text-slate-600 font-mono text-xs">{r.profile_cup_id || '-'}</td>
                            <td className="px-3 py-2 font-mono text-indigo-600">{r.verify_code}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${r.card_status === 'used' ? 'bg-green-100 text-green-700' : r.card_status === 'expired' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                {r.card_status === 'used' ? '已核销' : r.card_status === 'expired' ? '已过期' : '未使用'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-xs">{r.card_created_at ? new Date(r.card_created_at).toLocaleString('zh-CN') : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                disabled={saving}
                onClick={openRejectModal}
                className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <XCircle size={18} /> 驳回
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => updateDetail('approved')}
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} 通过审核
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 驳回理由弹窗 */}
      {rejectModal && detail && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-6" onClick={() => !saving && setRejectModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 mb-2">填写驳回理由</h3>
            <p className="text-sm text-slate-500 mb-4">商户将看到此理由，便于修改后重新提交。</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="例如：活动时间与现有活动冲突，请调整后重新提交"
              maxLength={500}
              rows={4}
              className="w-full bg-slate-50 rounded-xl px-3 py-3 text-sm resize-none border border-slate-200 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300"
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">{rejectReason.length}/500</p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setRejectModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                取消
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => updateDetail('rejected', rejectReason)}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />} 确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
