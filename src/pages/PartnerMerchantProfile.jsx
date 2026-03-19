import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { ArrowLeft, GripVertical, Loader2, MapPin, Phone, Scissors, Store } from 'lucide-react'
import { usePartnerAuth } from '../context/PartnerAuthContext'
import { memFire } from '../context/PartnerAuthContext'
import {
  getLatestMerchantProfileRequest,
  getLatestMerchantProfileRequestByPartnerAccount,
  submitMerchantProfileRequest
} from '../lib/merchantProfileReviewService'

const MAX_IMAGES = 5
const SHOP_CATEGORIES = [
  {
    name: '咖啡/饮茶',
    items: ['精品咖啡店', '书店咖啡吧', '日咖夜酒', '新中式茶饮', '饮茶空间', '围炉煮茶']
  },
  {
    name: '餐吧',
    items: ['西式餐吧 (Bistro)', '泰式餐吧', '户外营地餐吧', '露台景观餐吧', '艺术空间餐吧']
  },
  {
    name: '酒吧',
    items: ['鸡尾酒吧', '威士忌吧', '清吧', '音乐酒吧', '日式居酒屋', '精酿']
  },
  {
    name: '其他',
    items: ['跳舞/电音', 'Live House', '黑胶听歌吧', '桌游/游戏吧', '绿植花艺店', '冥想疗愈室', '复古电玩吧', 'DIY工作坊']
  }
]

function statusText(status) {
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '已驳回'
  return '待审核'
}

function normalizePartnerError(message) {
  const raw = String(message || '').trim()
  if (!raw) {
    return {
      userMessage: '提交失败，请稍后重试。',
      errorCode: 'E_PARTNER_SUBMIT_UNKNOWN',
      raw: ''
    }
  }
  if (raw.includes('已有待审核记录')) {
    return {
      userMessage: '你已经提交过一条待审核记录，请等管理员处理后再提交。',
      errorCode: 'E_PARTNER_REVIEW_PENDING',
      raw
    }
  }
  if (raw.includes('violates foreign key constraint') && raw.includes('bar_id')) {
    return {
      userMessage: '当前门店绑定状态异常，请刷新页面后重试。',
      errorCode: 'E_PARTNER_BAR_BINDING_INVALID',
      raw
    }
  }
  if (raw.includes('merchant_profile_change_requests')) {
    return {
      userMessage: '审核服务暂时不可用，请联系管理员检查审核表配置。',
      errorCode: 'E_PARTNER_REVIEW_TABLE',
      raw
    }
  }
  return {
    userMessage: '提交失败，请稍后重试。',
    errorCode: 'E_PARTNER_SUBMIT_GENERIC',
    raw
  }
}

function moveItem(arr, fromIndex, toIndex) {
  const copy = [...arr]
  const [removed] = copy.splice(fromIndex, 1)
  copy.splice(toIndex, 0, removed)
  return copy
}

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = new Image()
  image.src = imageSrc
  await new Promise((resolve) => (image.onload = resolve))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob], 'partner_cropped.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  })
}

function PhotoItem({ item, index, isFirst, onRemove, onDragStart, onDrop, isDragging }) {
  const src = item.type === 'existing' ? item.url : item.previewUrl
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(index)); e.dataTransfer.effectAllowed = 'move'; onDragStart?.(index) }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDrop={(e) => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain'), 10); if (from !== index) onDrop?.(from, index) }}
      onDragEnd={() => onDragStart?.(null)}
      className={`relative aspect-square rounded-cc border overflow-hidden bg-cc-neutral-100 cursor-grab active:cursor-grabbing ${isDragging ? 'ring-2 ring-cc-primary shadow-lg z-10' : 'border-cc-border'}`}
    >
      <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute top-1 right-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded"
      >
        删除
      </button>
      <div className="absolute left-1 top-1 bg-white/85 rounded p-0.5 text-cc-neutral-700">
        <GripVertical size={12} />
      </div>
      {isFirst ? (
        <div className="absolute bottom-0 left-0 right-0 text-center text-[10px] font-bold py-0.5 bg-cc-primary/85 text-white">
          封面图
        </div>
      ) : null}
    </div>
  )
}

export default function PartnerMerchantProfile() {
  const navigate = useNavigate()
  const { barId, barInfo, barRemovedByAdmin, partnerAccount, loading: authLoading, isPartnerLoggedIn, refreshBarInfo, refreshPartnerSession } = usePartnerAuth()

  const [formData, setFormData] = useState({
    name: '',
    category: '鸡尾酒吧',
    address: '',
    contact_phone: '',
    description: ''
  })
  const [photoItems, setPhotoItems] = useState([])
  const [photoDragIndex, setPhotoDragIndex] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [latestRequest, setLatestRequest] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [cropModal, setCropModal] = useState({ show: false, image: null })
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [CropperComponent, setCropperComponent] = useState(null)

  useEffect(() => {
    if (cropModal.show && !CropperComponent) {
      import('react-easy-crop').then((m) => setCropperComponent(() => m.default))
    }
  }, [cropModal.show, CropperComponent])

  const loadLatestRequest = useCallback(async () => {
    if (!barId && !partnerAccount?.id) return
    setStatusLoading(true)
    setErrorMsg('')
    try {
      const row = barId
        ? await getLatestMerchantProfileRequest(barId)
        : await getLatestMerchantProfileRequestByPartnerAccount(partnerAccount?.id)
      setLatestRequest(row)
    } catch (err) {
      setErrorMsg(err?.message || '读取审核状态失败')
    } finally {
      setStatusLoading(false)
    }
  }, [barId, partnerAccount?.id])

  useEffect(() => {
    if (!barInfo) return
    setFormData({
      name: barInfo?.name || '',
      category: barInfo?.category || '鸡尾酒吧',
      address: barInfo?.address || '',
      contact_phone: barInfo?.contact_phone || '',
      description: barInfo?.description || ''
    })
    const imgs = Array.isArray(barInfo?.detail_images) && barInfo.detail_images.length
      ? barInfo.detail_images
      : (barInfo?.cover_image_url ? [barInfo.cover_image_url] : [])
    setPhotoItems(imgs.slice(0, MAX_IMAGES).map(url => ({ type: 'existing', url })))
  }, [barInfo])

  useEffect(() => {
    if (!barId && partnerAccount?.id) refreshPartnerSession()
  }, [barId, partnerAccount?.id, refreshPartnerSession])

  useEffect(() => {
    if (barId || partnerAccount?.id) loadLatestRequest()
  }, [barId, partnerAccount?.id, loadLatestRequest])

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoItems.length >= MAX_IMAGES) {
      alert(`最多只能上传 ${MAX_IMAGES} 张图片`)
      return
    }
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCropModal({ show: true, image: reader.result })
    }
    e.target.value = ''
  }

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleCropSave = async () => {
    try {
      let file = await getCroppedImg(cropModal.image, croppedAreaPixels)
      file = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1280,
        useWebWorker: true
      })
      const previewUrl = URL.createObjectURL(file)
      setPhotoItems(prev => [...prev, { type: 'new', file, previewUrl }])
      setCropModal({ show: false, image: null })
    } catch (err) {
      alert(err?.message || '裁剪失败')
    }
  }

  const removePhoto = (index) => {
    setPhotoItems(prev => {
      const next = [...prev]
      const item = next[index]
      if (item?.type === 'new' && item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      next.splice(index, 1)
      return next
    })
  }

  const handlePhotoDrop = useCallback((fromIndex, toIndex) => {
    setPhotoItems(prev => moveItem(prev, fromIndex, toIndex))
    setPhotoDragIndex(null)
  }, [])

  const uploadFile = async (file, folder) => {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await memFire.storage.from('cup-images').upload(path, file)
    if (error) throw error
    const { data } = memFire.storage.from('cup-images').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!barId && !partnerAccount?.id) return
    if (!formData.name.trim() || !formData.address.trim() || !formData.contact_phone.trim()) {
      alert('请先填写完整门店名称、地址和商户电话')
      return
    }
    if (!photoItems.length) {
      alert('请至少上传 1 张门店图片')
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    try {
      const effectiveBarId = barInfo?.id || null
      const detailImages = []
      for (const item of photoItems.slice(0, MAX_IMAGES)) {
        if (item.type === 'existing') detailImages.push(item.url)
        else detailImages.push(await uploadFile(item.file, 'bar-details'))
      }

      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        address: formData.address.trim(),
        contact_phone: formData.contact_phone.trim(),
        description: (formData.description || '').trim(),
        cover_image_url: detailImages[0] || '',
        detail_images: detailImages
      }

      await submitMerchantProfileRequest({
        barId: effectiveBarId,
        partnerAccountId: partnerAccount?.id || null,
        requestType: effectiveBarId ? 'update' : 'create',
        payload,
        submittedByEmail: partnerAccount?.email || ''
      })
      if (effectiveBarId) await refreshBarInfo()
      await loadLatestRequest()
      alert('已提交审核，管理员处理后生效')
    } catch (err) {
      setErrorMsg(err?.message || '提交审核失败')
    } finally {
      setSubmitting(false)
    }
  }

  const previewImage = useMemo(() => {
    const first = photoItems[0]
    if (!first) return ''
    return first.type === 'existing' ? first.url : first.previewUrl
  }, [photoItems])
  const partnerErrorView = useMemo(
    () => (errorMsg ? normalizePartnerError(errorMsg) : null),
    [errorMsg]
  )

  if (!authLoading && !isPartnerLoggedIn) {
    return <Navigate to="/partner/login" replace />
  }

  return (
    <div className="min-h-screen bg-cc-neutral-50">
      {cropModal.show && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex flex-col items-center justify-center p-6">
          <div className="relative w-full max-w-lg aspect-square bg-cc-neutral-100 rounded-cc-2xl overflow-hidden shadow-2xl border border-cc-border">
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
              <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin" size={30} /></div>
            )}
          </div>
          <div className="mt-6 w-full max-w-lg flex items-center gap-4">
            <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(e.target.value)} className="flex-1 accent-indigo-500" />
            <button type="button" onClick={() => setCropModal({ show: false, image: null })} className="bg-cc-neutral-100 text-cc-neutral-700 px-4 py-2 rounded-cc font-bold">
              取消
            </button>
            <button type="button" onClick={handleCropSave} className="bg-cc-primary text-white px-4 py-2 rounded-cc font-bold flex items-center gap-1">
              <Scissors size={14} /> 保存裁剪
            </button>
          </div>
        </div>
      )}

      <nav className="bg-cc-surface/80 backdrop-blur-sm border-b border-cc-border px-6 py-4 sticky top-0 z-40 flex items-center justify-between shadow-cc-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/partner/dashboard')}
            className="text-cc-neutral-500 hover:text-cc-primary flex items-center gap-1 text-sm font-medium"
          >
            <ArrowLeft size={16} /> 返回仪表盘
          </button>
          <div className="h-4 w-px bg-cc-border" />
          <h1 className="text-base font-semibold text-cc-neutral-800">商户信息编辑</h1>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-6">
          <h2 className="text-lg font-bold text-cc-neutral-800 mb-1">提交店铺资料审核</h2>
          <p className="text-xs text-cc-neutral-500 mb-5">商户端无需填写经纬度，定位信息由平台审核时补全。</p>
          {barRemovedByAdmin ? (
            <div className="mb-5 rounded-cc border border-amber-300 bg-amber-50 px-3 py-2">
              <p className="text-sm font-semibold text-amber-800">该资料已被官方移除，请创建新的店铺信息后再提交审核。</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-cc-neutral-500 mb-1.5">店铺名称</label>
              <input
                required
                className="w-full bg-cc-neutral-100 border-0 rounded-cc px-4 py-3"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-cc-neutral-500 mb-1.5">店面分类</label>
              <select
                className="w-full bg-cc-neutral-100 border-0 rounded-cc px-4 py-3"
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
              >
                {SHOP_CATEGORIES.map(cat => (
                  <optgroup key={cat.name} label={cat.name}>
                    {cat.items.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-cc-neutral-500 mb-1.5">详细地址</label>
              <input
                required
                className="w-full bg-cc-neutral-100 border-0 rounded-cc px-4 py-3"
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-cc-neutral-500 mb-1.5">商户电话</label>
              <input
                required
                className="w-full bg-cc-neutral-100 border-0 rounded-cc px-4 py-3"
                value={formData.contact_phone}
                onChange={e => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-cc-neutral-500 mb-1.5">门店介绍</label>
              <textarea
                rows={4}
                className="w-full bg-cc-neutral-100 border-0 rounded-cc px-4 py-3 resize-none"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-cc-neutral-500 mb-2">店铺图片（最多 5 张）</label>
              <div className="grid grid-cols-5 gap-2">
                {photoItems.map((item, idx) => (
                  <PhotoItem
                    key={idx}
                    item={item}
                    index={idx}
                    isFirst={idx === 0}
                    onRemove={removePhoto}
                    onDragStart={setPhotoDragIndex}
                    onDrop={handlePhotoDrop}
                    isDragging={photoDragIndex === idx}
                  />
                ))}
                {photoItems.length < MAX_IMAGES && (
                  <label className="aspect-square rounded-cc border-2 border-dashed border-cc-border flex items-center justify-center text-xs text-cc-neutral-500 cursor-pointer">
                    添加
                    <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                  </label>
                )}
              </div>
            </div>

            {partnerErrorView ? (
              <div className="rounded-cc border border-cc-error/20 bg-cc-error-bg/40 px-3 py-2">
                <p className="text-sm text-cc-error font-medium">{partnerErrorView.userMessage}</p>
                <p className="text-xs text-cc-error/80 mt-1">错误码：{partnerErrorView.errorCode}</p>
                <details className="mt-2">
                  <summary className="text-xs text-cc-neutral-500 cursor-pointer">查看技术详情</summary>
                  <pre className="mt-1 text-[11px] text-cc-neutral-500 whitespace-pre-wrap break-all">{partnerErrorView.raw}</pre>
                </details>
              </div>
            ) : null}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-cc-primary text-white px-5 py-3 rounded-cc font-bold disabled:opacity-50"
              >
                {submitting ? '提交中…' : (barId ? '提交审核' : '提交新店审核')}
              </button>
            </div>
          </form>
        </section>

        <section className="lg:col-span-2 bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-6">
          <h3 className="text-base font-bold text-cc-neutral-800 mb-1">App 展示预览</h3>
          <p className="text-xs text-cc-neutral-500 mb-4">仅用于预览效果，以审核通过后线上展示为准。</p>

          {statusLoading ? (
            <p className="text-xs text-cc-neutral-500 flex items-center gap-1 mb-3"><Loader2 size={12} className="animate-spin" /> 读取审核状态中…</p>
          ) : latestRequest ? (
            <p className="text-xs text-cc-neutral-500 mb-3">
              最新审核状态：
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                latestRequest.status === 'approved'
                  ? 'bg-cc-success-bg text-cc-success'
                  : latestRequest.status === 'rejected'
                    ? 'bg-cc-error-bg text-cc-error'
                    : 'bg-cc-warning-bg text-cc-warning'
              }`}>
                {statusText(latestRequest.status)}
              </span>
            </p>
          ) : (
            <p className="text-xs text-cc-neutral-500 mb-3">暂无审核记录</p>
          )}

          <div className="rounded-cc-xl border border-cc-border overflow-hidden bg-white">
            <div className="h-40 bg-cc-neutral-100">
              {previewImage ? (
                <img src={previewImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-cc-neutral-400"><Store size={22} /></div>
              )}
            </div>
            <div className="p-4">
              <h4 className="text-xl font-black text-cc-neutral-800">{formData.name || '店铺名称'}</h4>
              <p className="text-sm text-cc-neutral-500 mt-1">{formData.category || '店面分类'}</p>
              <p className="text-sm text-cc-neutral-600 mt-2 flex items-center gap-1"><MapPin size={14} /> {formData.address || '店铺地址'}</p>
              <p className="text-sm text-cc-neutral-600 mt-1 flex items-center gap-1"><Phone size={14} /> {formData.contact_phone || '商户电话'}</p>
              <p className="text-sm text-cc-neutral-600 mt-3 leading-relaxed">{formData.description || '店铺介绍内容'}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
