import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { ArrowLeft, Megaphone, Loader2, Send, Save, Pencil, FileText, Upload, Scissors, Trash2 } from 'lucide-react'
import { isAdminAuthenticated } from '../lib/adminSession'
import AdminPartnerRequestQuickLinks from '../components/AdminPartnerRequestQuickLinks'
import {
  deleteAnnouncementById,
  fetchAnnouncements,
  publishAnnouncementAndPushMessages,
  upsertAnnouncement,
  uploadAnnouncementCover
} from '../lib/appOfficialMessagesService'

const EMPTY_FORM = {
  id: null,
  title: '',
  summary: '',
  content: '',
  cover_image_url: '',
  status: 'draft'
}

function prettyTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleString()
}

async function getCroppedBannerFile(imageSrc, pixelCrop) {
  const image = new Image()
  image.src = imageSrc
  await new Promise((resolve) => {
    image.onload = resolve
  })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = Math.max(1, Math.round(pixelCrop.width))
  canvas.height = Math.max(1, Math.round(pixelCrop.height))
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('封面裁剪失败'))
        resolve(new File([blob], `official_banner_${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92
    )
  })
}

export default function AppOfficialMessages() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishingId, setPublishingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [list, setList] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [cropModal, setCropModal] = useState({ show: false, image: null })
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [CropperComponent, setCropperComponent] = useState(null)
  const fileInputRef = useRef(null)

  const isAuthenticated = isAdminAuthenticated()
  const isEditing = Boolean(form.id)

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const rows = await fetchAnnouncements()
      setList(rows)
    } catch (err) {
      setErrorMsg(err?.message || '加载官方消息失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (cropModal.show && !CropperComponent) {
      import('react-easy-crop').then((m) => setCropperComponent(() => m.default))
    }
  }, [cropModal.show, CropperComponent])

  const statusClass = useMemo(() => ({
    draft: 'bg-cc-neutral-100 text-cc-neutral-600',
    published: 'bg-cc-success-bg text-cc-success',
    archived: 'bg-cc-warning-bg text-cc-warning'
  }), [])

  if (!isAuthenticated) return <Navigate to="/admin/bars" replace />

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')
    try {
      const saved = await upsertAnnouncement(form)
      setForm({
        id: saved.id,
        title: saved.title || '',
        summary: saved.summary || '',
        content: saved.content || '',
        cover_image_url: saved.cover_image_url || '',
        status: saved.status || 'draft'
      })
      await loadData()
      alert(isEditing ? '草稿已保存（未推送）。需点击“立即发布”才会推送到 App。' : '草稿已创建（未推送）。需点击“立即发布”才会推送到 App。')
    } catch (err) {
      setErrorMsg(err?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish(row) {
    if (row.status === 'published') return
    setPublishingId(row.id)
    setErrorMsg('')
    try {
      const result = await publishAnnouncementAndPushMessages(row)
      await loadData()
      if (result.pushed > 0) {
        alert(`发布成功，已推送 ${result.pushed} 条系统公告消息`)
      } else {
        alert('该公告已发布，无需重复发布')
      }
    } catch (err) {
      setErrorMsg(err?.message || '发布失败')
    } finally {
      setPublishingId(null)
    }
  }

  async function handleDelete(row) {
    const ok = window.confirm(`确认删除公告「${row.title || '未命名公告'}」？删除后不可恢复。`)
    if (!ok) return
    setDeletingId(row.id)
    setErrorMsg('')
    try {
      await deleteAnnouncementById(row.id)
      if (form.id === row.id) setForm(EMPTY_FORM)
      await loadData()
      alert('公告已删除')
    } catch (err) {
      setErrorMsg(err?.message || '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  function editRow(row) {
    setForm({
      id: row.id,
      title: row.title || '',
      summary: row.summary || '',
      content: row.content || '',
      cover_image_url: row.cover_image_url || '',
      status: row.status || 'draft'
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onCropComplete = useCallback((_, area) => {
    setCroppedAreaPixels(area)
  }, [])

  function handleCoverSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setCropModal({ show: true, image: url })
    e.target.value = ''
  }

  async function handleCropUpload() {
    if (!cropModal.image || !croppedAreaPixels) {
      setErrorMsg('请先调整 16:9 横幅裁剪区域')
      return
    }
    setCoverUploading(true)
    setErrorMsg('')
    try {
      const cropped = await getCroppedBannerFile(cropModal.image, croppedAreaPixels)
      const compressed = await imageCompression(cropped, {
        maxSizeMB: 0.6,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      })
      const url = await uploadAnnouncementCover(compressed)
      setForm((s) => ({ ...s, cover_image_url: url }))
      setCropModal({ show: false, image: null })
    } catch (err) {
      setErrorMsg(err?.message || '封面图上传失败')
    } finally {
      setCoverUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cc-neutral-50">
      <nav className="bg-cc-surface/80 backdrop-blur-sm border-b border-cc-border px-6 py-4 sticky top-0 z-40 flex items-center justify-between shadow-cc-sm">
        <div className="flex items-center gap-2.5">
          <Link to="/admin/dashboard" className="text-cc-neutral-500 hover:text-cc-primary flex items-center gap-2 font-medium">
            <ArrowLeft size={18} strokeWidth={1.5} /> CupCup管理首页
          </Link>
          <div className="h-5 w-px bg-cc-border" />
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 text-slate-700 p-2 rounded-cc"><Megaphone size={20} strokeWidth={1.5} /></div>
            <h1 className="text-lg font-semibold text-cc-neutral-800">App 官方消息</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AdminPartnerRequestQuickLinks />
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-6">
          <h2 className="text-base font-bold text-cc-neutral-800 mb-4">{isEditing ? '编辑公告' : '新建公告'}</h2>
          <form className="space-y-4" onSubmit={handleSave}>
            <div>
              <label className="block text-xs font-bold text-cc-neutral-500 mb-2">标题</label>
              <input
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                className="w-full bg-cc-neutral-100 border-0 rounded-cc px-4 py-3 outline-none"
                placeholder="例如：CupCup 本周更新说明"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-cc-neutral-500 mb-2">摘要（列表文案）</label>
              <textarea
                rows={2}
                value={form.summary}
                onChange={(e) => setForm((s) => ({ ...s, summary: e.target.value }))}
                className="w-full bg-cc-neutral-100 border-0 rounded-cc px-4 py-3 outline-none resize-none"
                placeholder="例如：本周新增打卡消息中心，优化首页卡片流畅度。"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-cc-neutral-500 mb-2">封面图（16:9 横幅）</label>
              <div className="w-full aspect-[16/9] rounded-cc overflow-hidden border border-cc-border bg-cc-neutral-100 mb-2">
                {form.cover_image_url ? (
                  <img src={form.cover_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-cc-neutral-500">
                    暂无封面图（建议 16:9）
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-cc-neutral-100 text-cc-neutral-700 font-bold px-3 py-2 rounded-cc inline-flex items-center gap-1.5"
                >
                  <Upload size={14} /> 上传封面图
                </button>
                {form.cover_image_url ? (
                  <button
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, cover_image_url: '' }))}
                    className="bg-cc-neutral-100 text-cc-neutral-600 font-bold px-3 py-2 rounded-cc"
                  >
                    清空
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] text-cc-neutral-500">上传后会先裁成 16:9 横幅，再压缩并存储。</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-cc-neutral-500 mb-2">正文（支持图文混排内容文本）</label>
              <textarea
                rows={10}
                value={form.content}
                onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))}
                className="w-full bg-cc-neutral-100 border-0 rounded-cc px-4 py-3 outline-none resize-y"
                placeholder="在这里输入官方消息正文..."
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-cc-primary text-white font-bold px-4 py-2.5 rounded-cc inline-flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? '保存中…' : '保存草稿'}
              </button>
              <button
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
                className="bg-cc-neutral-100 text-cc-neutral-600 font-bold px-4 py-2.5 rounded-cc"
              >
                新建一条
              </button>
            </div>
          </form>
          {errorMsg ? <p className="mt-4 text-sm font-semibold text-cc-error">{errorMsg}</p> : null}
        </section>

        <section className="lg:col-span-3 bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-cc-neutral-800">公告列表</h2>
            <button type="button" onClick={loadData} className="text-xs font-bold text-cc-primary">刷新</button>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-cc-primary" /></div>
          ) : list.length === 0 ? (
            <div className="rounded-cc border border-dashed border-cc-border py-10 text-center text-sm font-semibold text-cc-neutral-500">
              暂无官方消息
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((row) => (
                <li key={row.id} className="rounded-cc-xl border border-cc-border bg-cc-neutral-50/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-cc-neutral-800 truncate">{row.title || '未命名公告'}</p>
                      <p className="text-xs text-cc-neutral-500 mt-1 line-clamp-2">{row.summary || row.content || '暂无摘要'}</p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-cc-neutral-500">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${statusClass[row.status] || statusClass.draft}`}>
                          {row.status === 'published' ? '已发布' : row.status === 'archived' ? '已归档' : '草稿'}
                        </span>
                        <span>创建：{prettyTime(row.created_at)}</span>
                        {row.published_at ? <span>发布：{prettyTime(row.published_at)}</span> : null}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => editRow(row)}
                        className="text-xs font-bold px-3 py-1.5 rounded-full bg-cc-neutral-100 text-cc-neutral-700 inline-flex items-center gap-1"
                      >
                        <Pencil size={12} /> 编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePublish(row)}
                        disabled={publishingId === row.id || deletingId === row.id || row.status === 'published'}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1 disabled:opacity-60 ${
                          row.status === 'published'
                            ? 'bg-cc-neutral-100 text-cc-neutral-400 cursor-not-allowed'
                            : 'bg-cc-success-bg text-cc-success'
                        }`}
                      >
                        {publishingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        {row.status === 'published' ? '已发布' : '立即发布'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={deletingId === row.id || publishingId === row.id}
                        className="text-xs font-bold px-3 py-1.5 rounded-full bg-cc-error-bg text-cc-error inline-flex items-center gap-1 disabled:opacity-60"
                      >
                        {deletingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        删除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 rounded-cc border border-dashed border-cc-border bg-cc-neutral-100/60 p-3 text-xs text-cc-neutral-600">
            <p className="font-bold mb-1 inline-flex items-center gap-1"><FileText size={12} /> 发布说明</p>
            <p>0. `保存草稿` 不会推送到 App，需点击 `立即发布` 才会发送消息。</p>
            <p>1. 发布后会向所有用户写入一条 `system_announcement` 消息。</p>
            <p>2. App 端系统公告可从消息列表进入详情页；其它类型消息仅列表展示。</p>
          </div>
        </section>
      </div>

      {cropModal.show ? (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-cc-surface rounded-cc-xl border border-cc-border shadow-cc p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-cc-neutral-800 inline-flex items-center gap-1.5">
                <Scissors size={14} /> 裁剪封面图（16:9）
              </h3>
              <button
                type="button"
                onClick={() => setCropModal({ show: false, image: null })}
                className="text-xs font-bold text-cc-neutral-500"
              >
                取消
              </button>
            </div>
            <div className="relative w-full aspect-[16/9] rounded-cc overflow-hidden bg-black/10">
              {cropModal.image && CropperComponent ? (
                <CropperComponent
                  image={cropModal.image}
                  crop={crop}
                  zoom={zoom}
                  aspect={16 / 9}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-cc-neutral-500">
                  载入裁剪器中...
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCropModal({ show: false, image: null })}
                className="bg-cc-neutral-100 text-cc-neutral-600 font-bold px-3 py-2 rounded-cc"
              >
                取消
              </button>
              <button
                type="button"
                disabled={coverUploading}
                onClick={handleCropUpload}
                className="bg-cc-primary text-white font-bold px-3 py-2 rounded-cc inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {coverUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {coverUploading ? '上传中…' : '确认裁剪并上传'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
