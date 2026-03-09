/**
 * 商户活动发布页：拉取当前门店信息展示于顶部，表单含头图(1:1裁切+300KB压缩)、标题24字、详情500字、黑卡数量3-15、日期范围，提交写入 bar_events 状态 pending
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import {
  Wine, Loader2, Image as ImageIcon, Scissors, MapPin, Phone, Calendar,
  FileText, Hash, Clock, CheckCircle2, XCircle, AlertCircle, Edit2, PieChart, ArrowLeft
} from 'lucide-react'
import { usePartnerAuth } from '../context/PartnerAuthContext'
import { memFire } from '../context/PartnerAuthContext'

const TITLE_MAX = 24
const CONTENT_MAX = 500
const BLACK_CARD_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 3) // 3..15

// 裁剪区域转 File（1:1 已由 aspect 保证）
async function getCroppedImg(imageSrc, pixelCrop) {
  const image = new Image()
  image.src = imageSrc
  await new Promise((resolve) => (image.onload = resolve))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(new File([blob], 'activity_cover.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.9)
  })
}

// 上传到 MemFire Storage，返回公链 URL
async function uploadActivityCover(file) {
  const path = `activity-covers/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`
  const { error } = await memFire.storage.from('cup-images').upload(path, file)
  if (error) throw error
  const { data } = memFire.storage.from('cup-images').getPublicUrl(path)
  return data.publicUrl
}

// 两段占比饼图：实际到店 vs 未到店（纯 SVG，无图表库）
function PieChartSvg({ totalSlots, actualVisit }) {
  const r = 40
  const cx = 50
  const cy = 50
  const ratio = totalSlots > 0 ? Math.min(1, actualVisit / totalSlots) : 0
  const angle1 = ratio * 360
  const toRad = (deg) => (deg - 90) * (Math.PI / 180)
  const point = (deg) => ({ x: cx + r * Math.cos(toRad(deg)), y: cy + r * Math.sin(toRad(deg)) })
  const large = (a, b) => (b - a > 180 ? 1 : 0)
  const path1 = angle1 > 0
    ? `M ${cx} ${cy} L ${point(0).x} ${point(0).y} A ${r} ${r} 0 ${large(0, angle1)} 1 ${point(angle1).x} ${point(angle1).y} Z`
    : ''
  const path2 = angle1 < 360
    ? `M ${cx} ${cy} L ${point(angle1).x} ${point(angle1).y} A ${r} ${r} 0 ${large(angle1, 360)} 1 ${point(360).x} ${point(360).y} Z`
    : ''
  return (
    <svg width={100} height={100} viewBox="0 0 100 100" className="shrink-0">
      <path d={path1} fill="#6366f1" stroke="#fff" strokeWidth={2} />
      <path d={path2} fill="#e2e8f0" stroke="#fff" strokeWidth={2} />
    </svg>
  )
}

export default function PartnerCreateActivity() {
  const navigate = useNavigate()
  const { barId, barInfo, loading: authLoading, refreshBarInfo, isPartnerLoggedIn, logout } = usePartnerAuth()

  const [barDisplay, setBarDisplay] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [targetBlackCardCount, setTargetBlackCardCount] = useState(5)
  const [maxParticipants, setMaxParticipants] = useState(10)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [address, setAddress] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [targetOwnBarOnly, setTargetOwnBarOnly] = useState(false) // 是否仅定向到本店的黑卡用户

  // 裁切弹窗
  const [cropModal, setCropModal] = useState({ show: false, image: null })
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [CropperComponent, setCropperComponent] = useState(null)
  useEffect(() => {
    if (cropModal.show && !CropperComponent) {
      import('react-easy-crop').then((m) => setCropperComponent(() => m.default))
    }
  }, [cropModal.show])

  // 已提交的活动列表（用于展示与审核状态）
  const [activitiesList, setActivitiesList] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  // 编辑某条活动（仅待审核/已驳回可编辑）
  const [editingEventId, setEditingEventId] = useState(null)
  const [editingCoverUrl, setEditingCoverUrl] = useState('')
  const [editingRejectReason, setEditingRejectReason] = useState('')

  // 未登录商户则跳转登录
  if (!authLoading && !isPartnerLoggedIn) {
    return <Navigate to="/partner/login" replace />
  }

  // 拉取门店信息用于顶部展示与表单默认值
  useEffect(() => {
    if (!barId || !barInfo) return
    setBarDisplay(barInfo)
    setAddress(barInfo.address ?? '')
    setContactPhone(barInfo.contact_phone ?? '')
  }, [barId, barInfo])

  useEffect(() => {
    if (barId) refreshBarInfo()
  }, [barId, refreshBarInfo])

  const fetchActivitiesList = useCallback(async () => {
    if (!barId) return
    setActivitiesLoading(true)
    const { data, error } = await memFire
      .from('bar_events')
      .select('id, title, cover_image_url, status, created_at, reject_reason, max_participants, actual_verified_count')
      .eq('bar_id', barId)
      .order('created_at', { ascending: false })
    setActivitiesLoading(false)
    if (!error && data) setActivitiesList(data)
    else setActivitiesList([])
  }, [barId])

  useEffect(() => {
    if (barId) fetchActivitiesList()
  }, [barId, fetchActivitiesList])

  // 饼图数据：仅统计审核通过的活动。发起活动人数 = 总名额，实际到店人数 = 核销人数汇总（后续可接拍杯打卡去重）
  const pieStats = (() => {
    const approved = activitiesList.filter((a) => a.status === 'approved')
    const totalSlots = approved.reduce((s, a) => s + (Number(a.max_participants) || 0), 0)
    const actualVisit = approved.reduce((s, a) => s + (Number(a.actual_verified_count) || 0), 0)
    return { totalSlots, actualVisit }
  })()

  const onCropComplete = useCallback((_, area) => {
    setCroppedAreaPixels(area)
  }, [])

  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCropModal({ show: true, image: url })
  }

  const handleCropSave = useCallback(async () => {
    if (!cropModal.image) return
    if (!croppedAreaPixels) {
      setSubmitError('请先拖动选择裁剪区域后再点击确认裁剪')
      return
    }
    try {
      const file = await getCroppedImg(cropModal.image, croppedAreaPixels)
      const options = { maxSizeMB: 0.3, maxWidthOrHeight: 1024, useWebWorker: true }
      const compressed = await imageCompression(file, options)
      setCoverFile(compressed)
      setCoverPreviewUrl(URL.createObjectURL(compressed))
      setCropModal({ show: false, image: null })
    } catch (err) {
      console.error(err)
      setSubmitError('头图裁剪或压缩失败')
    }
  }, [cropModal.image, croppedAreaPixels])

  const handleStartEdit = async (eventId) => {
    const { data, error } = await memFire.from('bar_events').select('*').eq('id', eventId).eq('bar_id', barId).single()
    if (error || !data) {
      setSubmitError('无法加载该活动')
      return
    }
    setTitle(data.title ?? '')
    setContent(data.content ?? '')
    setTargetBlackCardCount(Math.min(15, Math.max(3, Number(data.target_black_card_count) || 5)))
    setMaxParticipants(Math.max(1, Number(data.max_participants) ?? 10))
    setStartTime(data.start_time ? data.start_time.slice(0, 16) : '')
    setEndTime(data.end_time ? data.end_time.slice(0, 16) : '')
    setAddress(data.address ?? '')
    setContactPhone(data.contact_phone ?? '')
    setCoverPreviewUrl(data.cover_image_url ?? '')
    setCoverFile(null)
    setEditingCoverUrl(data.cover_image_url ?? '')
    setEditingRejectReason(data.reject_reason ?? '')
    setEditingEventId(eventId)
    setSubmitError('')
  }

  const handleCancelEdit = () => {
    setEditingEventId(null)
    setEditingCoverUrl('')
    setEditingRejectReason('')
    setTitle('')
    setContent('')
    setTargetBlackCardCount(5)
    setMaxParticipants(10)
    setStartTime('')
    setEndTime('')
    setAddress(barDisplay?.address ?? '')
    setContactPhone(barDisplay?.contact_phone ?? '')
    setCoverFile(null)
    setCoverPreviewUrl('')
    setSubmitError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    const hasCover = coverFile || coverPreviewUrl
    if (!hasCover) {
      setSubmitError('请上传活动头图（1:1 并已压缩）')
      return
    }
    if (!startTime || !endTime) {
      setSubmitError('请选择活动开始与结束时间')
      return
    }
    if (new Date(endTime) <= new Date(startTime)) {
      setSubmitError('结束时间须晚于开始时间')
      return
    }
    const maxP = Number(maxParticipants)
    if (!Number.isInteger(maxP) || maxP < 1) {
      setSubmitError('请填写活动名额限制（至少 1 人）')
      return
    }
    setSubmitting(true)
    try {
      const coverImageUrl = coverFile ? await uploadActivityCover(coverFile) : (editingCoverUrl || '')
      const payload = {
        bar_id: barId,
        bar_name: barDisplay?.name ?? '',
        cover_image_url: coverImageUrl,
        title: title.trim().slice(0, TITLE_MAX),
        content: (content.trim().slice(0, CONTENT_MAX) || ''),
        target_black_card_count: targetBlackCardCount,
        target_own_bar_only: targetOwnBarOnly,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        address: address.trim(),
        contact_phone: contactPhone.trim(),
        status: 'pending',
        max_participants: Math.max(1, Number(maxParticipants)) || 10,
        actual_verified_count: 0
      }
      // 始终新增一条待审核记录，便于管理员看到「新申请」；不修改原驳回/待审核记录
      const { error: insertErr } = await memFire.from('bar_events').insert([payload])
      if (insertErr) throw insertErr
      alert(editingEventId
        ? '已作为新申请提交，管理员将看到新的待审核记录。原记录保留不变。'
        : '活动已提交，状态为「待审核」。审核通过后将自动向黑卡用户发卡。')
      handleCancelEdit()
      setTitle('')
      setContent('')
      setCoverFile(null)
      setCoverPreviewUrl('')
      setStartTime('')
      setEndTime('')
      fetchActivitiesList()
    } catch (err) {
      setSubmitError(err?.message || '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-cc-neutral-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-cc-primary" size={40} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cc-neutral-50 pb-20">
      {/* 裁切弹窗：Grid 布局，底部操作栏固定一行、始终在视口内且可点击 */}
      {cropModal.show && (
        <div
          className="fixed inset-0 z-[100] bg-cc-neutral-900/50"
          style={{
            display: 'grid',
            gridTemplateRows: '1fr auto',
            height: '100dvh'
          }}
        >
          {/* 上：裁剪区，限制高度不压住底部栏 */}
          <div className="min-h-0 overflow-auto flex items-center justify-center p-4" style={{ position: 'relative', zIndex: 1 }}>
            <div
              className="bg-cc-neutral-100 rounded-cc-xl overflow-hidden shrink-0 border border-cc-border"
              style={{ width: 'min(400px, 65vmin)', height: 'min(400px, 65vmin)' }}
            >
              {CropperComponent ? (
                <CropperComponent
                  image={cropModal.image}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <Loader2 className="animate-spin" size={32} />
                </div>
              )}
            </div>
          </div>
          {/* 下：操作栏，独立一行、保证露出且可点（避免被裁切层遮挡） */}
          <div
            className="w-full bg-cc-neutral-100 border-t border-cc-border px-4 py-4 flex flex-col items-center justify-center gap-2"
            style={{ minHeight: '120px', position: 'relative', zIndex: 20, pointerEvents: 'auto' }}
          >
            <div className="w-full max-w-md flex flex-wrap items-center justify-center gap-3">
              <span className="text-white text-sm font-semibold">缩放</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-32 sm:w-40 accent-cc-primary cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setCropModal({ show: false, image: null })}
                className="bg-cc-neutral-500 hover:bg-cc-neutral-600 text-white font-bold px-5 py-2.5 rounded-cc cursor-pointer border-0 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCropSave}
                className="bg-cc-primary hover:bg-cc-primary-hover text-white font-bold px-6 py-2.5 rounded-cc flex items-center gap-2 cursor-pointer border-0 transition-colors"
              >
                <Scissors size={18} /> 确认裁剪
              </button>
            </div>
            <p className="text-cc-neutral-500 text-xs">1:1 裁切后将压缩至 300KB 内</p>
          </div>
        </div>
      )}

      {/* 顶栏 */}
      <nav className="bg-cc-surface border-b border-cc-border px-6 py-4 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/partner/dashboard')}
            className="p-2 -ml-2 rounded-cc text-cc-neutral-600 hover:bg-cc-neutral-100 hover:text-cc-neutral-800 transition-colors"
            title="返回仪表盘"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="bg-cc-primary p-2 rounded-cc text-white">
            <Wine size={22} />
          </div>
          <span className="font-bold text-cc-neutral-800">商户后台 · 发布活动</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/partner/create-activity')}
            className="text-sm font-bold text-cc-primary hover:underline"
          >
            发布活动
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout()
              // 使用整页跳转避免 React 在注销后因 Hook 顺序变更报错 (#300)，并确保退出后总是回到登录页
              window.location.href = '/partner/login'
            }}
            className="text-sm font-bold text-cc-neutral-500 hover:text-cc-error"
          >
            退出登录
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 顶部：当前门店信息 + 到店转化饼图 */}
        <div className="flex flex-col lg:flex-row gap-6 mb-6">
          {barDisplay && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Wine size={14} /> 当前门店
              </h2>
              <div className="flex gap-4">
                {barDisplay.cover_image_url ? (
                  <img
                    src={barDisplay.cover_image_url}
                    alt=""
                    className="w-20 h-20 rounded-xl object-cover border border-slate-100"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <ImageIcon size={28} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 truncate">{barDisplay.name || '未命名门店'}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {barDisplay.address || '未填写地址'}
                  </p>
                  {barDisplay.contact_phone && (
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone size={12} /> {barDisplay.contact_phone}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 发起活动人数 vs 实际到店人数 占比图（仅统计审核通过的活动） */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 shrink-0">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <PieChart size={14} /> 到店转化
            </h2>
            <div className="flex items-center gap-4">
              {pieStats.totalSlots > 0 ? (
                <>
                  <PieChartSvg totalSlots={pieStats.totalSlots} actualVisit={pieStats.actualVisit} />
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-indigo-500 shrink-0" />
                      <span className="text-slate-600">实际到店：<strong>{pieStats.actualVisit}</strong> 人</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-slate-200 shrink-0" />
                      <span className="text-slate-600">未到店：<strong>{Math.max(0, pieStats.totalSlots - pieStats.actualVisit)}</strong> 人</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">总名额（审核通过活动）：{pieStats.totalSlots} 人</p>
                    <p className="text-xs text-slate-400">实际到店为核销人数汇总；拍杯打卡去重可后续接入</p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 py-4 px-6">
                  <PieChart size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">暂无审核通过的活动</p>
                  <p className="text-xs mt-0.5">活动通过后将在此显示名额与到店占比</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 左列表 + 右表单 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：已提交的活动列表 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-24">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock size={14} /> 已提交的活动
              </h2>
              {activitiesLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="animate-spin" size={24} />
                </div>
              ) : activitiesList.length > 0 ? (
                <ul className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto">
                  {activitiesList.map((item) => (
                    <li key={item.id} className={`flex gap-3 p-3 rounded-xl border transition-colors ${editingEventId === item.id ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-100 hover:bg-slate-50/50'}`}>
                      {item.cover_image_url ? (
                        <img src={item.cover_image_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-100 shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-slate-400">
                          <ImageIcon size={20} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{item.title || '未命名活动'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 mt-1.5 text-xs font-bold px-2 py-0.5 rounded ${
                            item.status === 'approved' ? 'bg-green-100 text-green-700' : item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {item.status === 'approved' && <CheckCircle2 size={10} />}
                          {item.status === 'rejected' && <XCircle size={10} />}
                          {item.status === 'pending' && <AlertCircle size={10} />}
                          {item.status === 'approved' ? '已发布' : item.status === 'rejected' ? '已驳回' : '待审核'}
                        </span>
                        <p className="mt-1.5 text-xs text-slate-600">
                          到店核销：{item.actual_verified_count ?? 0} / {item.max_participants ?? 0} 人
                        </p>
                        {item.status === 'rejected' && item.reject_reason && (
                          <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2">
                            <span className="font-bold">驳回理由：</span>{item.reject_reason}
                          </p>
                        )}
                        {(item.status === 'pending' || item.status === 'rejected') && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item.id)}
                            className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            <Edit2 size={12} /> 编辑
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 text-sm py-4">暂无已提交活动，提交后将显示在此处</p>
              )}
            </div>
          </div>

          {/* 右侧：新建活动表单 */}
          <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <FileText size={22} /> {editingEventId ? '编辑活动' : '新建黑卡专属活动'}
            </h2>
            {editingEventId && (
              <button type="button" onClick={handleCancelEdit} className="text-sm font-bold text-slate-500 hover:text-slate-700">
                取消编辑
              </button>
            )}
          </div>

          {editingEventId && editingRejectReason && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm font-bold text-red-800 mb-1">上次驳回理由</p>
              <p className="text-sm text-red-700">{editingRejectReason}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 活动头图：1:1 裁切 + 300KB 压缩 */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                <ImageIcon size={16} /> 活动头图 <span className="text-slate-400 font-normal">(1:1 裁切，≤300KB){editingEventId ? '，不更换则保留原图' : ''}</span>
              </label>
              {coverPreviewUrl ? (
                <div className="relative inline-block">
                  <img src={coverPreviewUrl} alt="" className="w-40 h-40 object-cover rounded-xl border-2 border-indigo-100" />
                  <button
                    type="button"
                    onClick={() => { setCoverFile(null); setCoverPreviewUrl(''); setEditingCoverUrl('') }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="inline-flex flex-col items-center justify-center w-40 h-40 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                  <ImageIcon className="text-slate-400 mb-1" size={32} />
                  <span className="text-xs font-bold text-slate-500">选择图片</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                </label>
              )}
            </div>

            {/* 活动标题 24 字 */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                <FileText size={16} /> 活动标题
              </label>
              <input
                type="text"
                maxLength={TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="例如：周末黑卡专属半价"
              />
              <p className="mt-1 text-right text-xs font-bold text-slate-400">{title.length}/{TITLE_MAX}</p>
            </div>

            {/* 是否定向到本店 */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-600">是否定向到本店</span>
                <span className="text-xs text-slate-500 mt-0.5">
                  仅给「在本店打出黑卡」的用户发 CupSSR 邀请卡
                </span>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={targetOwnBarOnly}
                  onChange={(e) => setTargetOwnBarOnly(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>{targetOwnBarOnly ? '仅本店' : '全局黑卡池'}</span>
              </label>
            </div>

            {/* 黑卡数量 3-15 */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                <Hash size={16} /> 定向黑卡数量
              </label>
              <select
                value={targetBlackCardCount}
                onChange={(e) => setTargetBlackCardCount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {BLACK_CARD_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} 张</option>
                ))}
              </select>
            </div>

            {/* 活动名额限制 */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                <Wine size={16} /> 活动名额限制 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={9999}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Math.min(9999, Math.max(0, Number(e.target.value) || 0)))}
                placeholder="例如 50"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
              <p className="mt-1 text-xs text-slate-500">活动邀请名额上限（人），用于统计转化率</p>
            </div>

            {/* 活动时间范围 */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                <Calendar size={16} /> 活动时间
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 block mb-1">开始</span>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">结束</span>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 活动详情 500 字 */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">活动详情与规则</label>
              <textarea
                maxLength={CONTENT_MAX}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="描述活动内容、规则、注意事项等…"
              />
              <p className="mt-1 text-right text-xs font-bold text-slate-400">{content.length}/{CONTENT_MAX}</p>
            </div>

            {/* 地址与电话（默认带出门店，可改） */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                <MapPin size={16} /> 活动地址
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="与门店一致可沿用上方地址"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                <Phone size={16} /> 联系电话
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="用于本活动的联系电话"
              />
            </div>

            {submitError && (
              <div className="text-red-600 text-sm font-semibold bg-red-50 rounded-xl px-4 py-2.5">
                {submitError}
              </div>
            )}

            {editingEventId && (
              <p className="text-xs text-slate-500 -mt-2">
                将作为<strong>新申请</strong>提交，管理员后台会看到新的待审核记录，原驳回/待审核记录不变。
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : null}
              {submitting ? '提交中…' : editingEventId ? '重新提交（新申请）' : '提交活动（待审核）'}
            </button>
          </form>
        </div>
          </div>
        </div>
      </div>
    </div>
  )
}
