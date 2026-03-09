import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, MapPin, Wine, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle, Edit2, X, Scissors, FileText, UserPlus, GripVertical, Settings } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { memFire } from '../lib/memfire'

function moveItem(arr, fromIndex, toIndex) {
  const copy = [...arr]
  const [removed] = copy.splice(fromIndex, 1)
  copy.splice(toIndex, 0, removed)
  return copy
}

// CupCup 酒吧管理后台：对接 MemFire（与 PartnerAuthContext 共用同一客户端，避免多实例）
// 登录账号：cupadmin  密码：cup9898
// 接口：bars 表、collected_cards 表、Storage 桶 cup-images（bar-details）

// 店面分类：四大类及其子项（下拉先选大类，再选子项）
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
const ALL_CATEGORY_ITEMS = SHOP_CATEGORIES.flatMap(c => c.items)

// 单张店铺照片（原生 HTML5 拖拽排序）
function PhotoItem({ item, isFirst, index, onRemove, onDragStart, onDragOver, onDrop, isDragging }) {
  const src = item.type === 'existing' ? item.url : item.previewUrl
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(index)); e.dataTransfer.effectAllowed = 'move'; onDragStart?.(index); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver?.(e, index); }}
      onDrop={(e) => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain'), 10); if (from !== index) onDrop?.(from, index); }}
      onDragEnd={() => onDragStart?.(null)}
      className={`relative aspect-square group rounded-cc border cursor-grab active:cursor-grabbing overflow-visible ${isDragging ? 'z-10 shadow-xl ring-2 ring-cc-primary opacity-80' : 'border-cc-border'}`}
    >
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <img src={src} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="p-2 rounded-full bg-white/90 text-cc-neutral-700"><GripVertical size={20} /></span>
        </div>
        {isFirst && (
          <div className="absolute bottom-0 left-0 right-0 bg-cc-primary/90 text-white text-[10px] font-bold text-center py-1 rounded-b-cc">封面图</div>
        )}
      </div>
      <button type="button" onClick={() => onRemove(index)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 min-w-[24px] min-h-[24px] flex items-center justify-center">
        <X size={12} />
      </button>
    </div>
  )
}

// 已发布酒吧列表行（原生 HTML5 拖拽排序）
function BarRow({ bar, isEditing, formName, formCategory, formAddress, coverPreviewUrl, onEdit, onDelete, onPartnerAccount, index, onDragStart, onDragOver, onDrop, isDragging }) {
  const coverUrl = isEditing ? coverPreviewUrl : (bar.cover_image_url || bar.image_name)
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(index)); e.dataTransfer.effectAllowed = 'move'; onDragStart?.(index); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver?.(e, index); }}
      onDrop={(e) => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain'), 10); if (from !== index) onDrop?.(from, index); }}
      onDragEnd={() => onDragStart?.(null)}
      className={`flex items-center gap-4 p-4 rounded-cc-xl border bg-cc-surface transition-all cursor-grab active:cursor-grabbing ${isDragging ? 'shadow-xl ring-2 ring-cc-primary z-10 opacity-80' : 'border-cc-border'} ${isEditing ? 'border-cc-primary ring-2 ring-cc-primary-subtle' : ''}`}
    >
      <span className="p-2 rounded-cc text-cc-neutral-400 shrink-0 pointer-events-none" title="拖拽调整顺序">
        <GripVertical size={20} />
      </span>
      <div className="w-20 h-20 rounded-cc overflow-hidden shrink-0 bg-cc-neutral-100">
        {coverUrl ? <img src={coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Wine size={24} className="text-cc-neutral-400" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-cc-neutral-800 truncate">{isEditing ? formName : bar.name}</h3>
        <p className="text-xs text-cc-neutral-500 truncate">{isEditing ? formCategory : bar.category}</p>
        <p className="text-xs text-cc-neutral-500 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {isEditing ? formAddress : bar.address}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button type="button" onClick={() => onPartnerAccount(bar)} className="bg-cc-neutral-100 text-cc-success p-2 rounded-cc hover:bg-cc-success-bg transition-colors" title="生成/重置商户账号">
          <UserPlus size={16} />
        </button>
        <button type="button" onClick={() => onEdit(bar)} className="bg-cc-neutral-100 text-cc-primary p-2 rounded-cc hover:bg-cc-primary-subtle transition-colors">
          <Edit2 size={16} />
        </button>
        <button type="button" onClick={() => onDelete(bar.id)} className="bg-cc-error text-white p-2 rounded-cc hover:opacity-90 transition-colors">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

// 辅助函数：将裁剪后的区域转为 File 对象
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
      resolve(new File([blob], 'cropped_image.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  })
}

/** 管理员后台：门店录入/编辑、酒吧列表（与 Partner 商户端分离） */
function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('isLoggedIn') === 'true')
  const [loginForm, setLoginForm] = useState({ id: '', password: '' })
  
  const [bars, setBars] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [oldName, setOldName] = useState('') // 🚨 新增：记录修改前的名字，用于同步更新已发布的动态
  
  // ... 裁剪相关状态保持不变
  const [cropModal, setCropModal] = useState({ show: false, image: null, index: null })
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  
  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    category: '鸡尾酒吧',
    address: '',
    latitude: '', 
    longitude: '', 
    description: ''
  })

  // 店铺照片：统一列表，支持拖拽排序。项为 { type: 'existing', url } | { type: 'new', file, previewUrl }
  const [photoItems, setPhotoItems] = useState([])

  // 生成/重置商户账号弹窗
  const [partnerAccountModal, setPartnerAccountModal] = useState({ show: false, bar: null })
  const [partnerEmail, setPartnerEmail] = useState('')
  const [partnerPassword, setPartnerPassword] = useState('')
  const [partnerSubmitting, setPartnerSubmitting] = useState(false)
  const [partnerError, setPartnerError] = useState('')

  // 裁剪组件：仅打开弹窗时动态加载，避免主包中 react-easy-crop 的 class 导致线上白屏
  const [CropperComponent, setCropperComponent] = useState(null)
  useEffect(() => {
    if (cropModal.show && !CropperComponent) {
      import('react-easy-crop').then((m) => setCropperComponent(() => m.default))
    }
  }, [cropModal.show])

  useEffect(() => {
    if (isAuthenticated) {
      fetchBars()
    }
  }, [isAuthenticated])

  const handleLogin = (e) => {
    e.preventDefault()
    if (loginForm.id === 'cupadmin' && loginForm.password === 'cup9898') {
      setIsAuthenticated(true)
      localStorage.setItem('isLoggedIn', 'true')
    } else {
      alert('账号或密码错误')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('isLoggedIn')
  }

  const fetchBars = async () => {
    setLoading(true)
    try {
      let query = memFire.from('bars').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false })
      let { data, error } = await query
      if (error && (error.code === '42703' || (error.message && error.message.includes('sort_order')))) {
        query = memFire.from('bars').select('*').order('created_at', { ascending: false })
        const retry = await query
        if (retry.error) throw retry.error
        setBars(retry.data || [])
      } else {
        if (error) throw error
        setBars(data || [])
      }
    } catch (error) {
      console.error('Error fetching bars:', error)
      alert('获取酒吧列表失败，请检查网络连接')
    } finally {
      setLoading(false)
    }
  }

  const [photoDragIndex, setPhotoDragIndex] = useState(null)
  const [barDragIndex, setBarDragIndex] = useState(null)
  const [barsSavingOrder, setBarsSavingOrder] = useState(false)

  const handlePhotoDrop = useCallback((fromIndex, toIndex) => {
    setPhotoItems((prev) => moveItem(prev, fromIndex, toIndex))
    setPhotoDragIndex(null)
  }, [])

  const handleBarDrop = useCallback(async (fromIndex, toIndex) => {
    const newBars = moveItem(bars, fromIndex, toIndex)
    setBars(newBars)
    setBarDragIndex(null)
    setBarsSavingOrder(true)
    try {
      await Promise.all(newBars.map((bar, i) =>
        memFire.from('bars').update({ sort_order: i }).eq('id', bar.id)
      ))
    } catch (err) {
      console.error('保存酒吧顺序失败:', err)
      const msg = err?.code === '42703' || (err?.message && err.message.includes('sort_order'))
        ? '保存顺序失败：数据库尚未添加 sort_order 字段。请在 MemFire 控制台执行 sql/partner_admin_bars_sort_order.sql 中的 SQL 后再试。'
        : '保存顺序失败，请重试'
      alert(msg)
      fetchBars()
    } finally {
      setBarsSavingOrder(false)
    }
  }, [bars])

  // 1. 处理原始图片选择 -> 触发裁剪
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (photoItems.length >= 5) {
      return alert('最多只能上传 5 张照片')
    }

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setCropModal({ show: true, image: reader.result, index: null })
    }
  }

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  // 2. 完成裁剪 -> 自动压缩 -> 加入列表
  const handleCropSave = async () => {
    try {
      // 获取裁剪后的文件
      let file = await getCroppedImg(cropModal.image, croppedAreaPixels)
      
      // 自动压缩图片
      const options = {
        maxSizeMB: 0.2, // 限制在 200KB 左右
        maxWidthOrHeight: 1024, // 限制最大尺寸
        useWebWorker: true
      }
      
      console.log('🚀 压缩前:', (file.size / 1024).toFixed(2), 'KB')
      file = await imageCompression(file, options)
      console.log('✅ 压缩后:', (file.size / 1024).toFixed(2), 'KB')

      const previewUrl = URL.createObjectURL(file)
      setPhotoItems(prev => [...prev, { type: 'new', file, previewUrl }])
      setCropModal({ show: false, image: null, index: null })
    } catch (e) {
      console.error(e)
      alert('裁剪/压缩失败')
    }
  }

  const removeFile = (index) => {
    setPhotoItems(prev => {
      const next = [...prev]
      const item = next[index]
      if (item?.type === 'new' && item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      next.splice(index, 1)
      return next
    })
  }

  const uploadFile = async (file, folder) => {
    const ext = file.name.split('.').pop()
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
    const { error } = await memFire.storage.from('cup-images').upload(path, file)
    if (error) throw error
    const { data } = memFire.storage.from('cup-images').getPublicUrl(path)
    return data.publicUrl
  }

  const handleEdit = (bar) => {
    setEditingId(bar.id)
    setOldName(bar.name || '') // 记录旧名字
    setFormData({
      name: bar.name || '',
      category: ALL_CATEGORY_ITEMS.includes(bar.category) ? bar.category : '鸡尾酒吧',
      address: bar.address || '',
      latitude: bar.latitude || '',
      longitude: bar.longitude || '',
      description: bar.description || ''
    })
    const urls = bar.detail_images?.length ? bar.detail_images : (bar.cover_image_url || bar.image_name ? [bar.cover_image_url || bar.image_name] : [])
    setPhotoItems(urls.map(url => ({ type: 'existing', url })))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFormData({ name: '', category: '鸡尾酒吧', address: '', latitude: '', longitude: '', description: '' })
    setPhotoItems([])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (photoItems.length === 0) return alert('请至少上传一张照片')
    
    setIsSubmitting(true)

    try {
      // 1. 按当前顺序（含拖拽后的顺序）生成 finalUrls
      const finalUrls = []
      for (const item of photoItems.slice(0, 5)) {
        if (item.type === 'existing') {
          finalUrls.push(item.url)
        } else {
          const url = await uploadFile(item.file, 'bar-details')
          finalUrls.push(url)
        }
      }

      // 2. 准备数据：第一张作为封面（image_name + cover_image_url），全集设为 detail_images（顺序与后台一致）
      const barData = {
        name: formData.name,
        category: formData.category,
        address: formData.address,
        latitude: (formData.latitude !== '' && !isNaN(formData.latitude)) ? parseFloat(formData.latitude) : null,
        longitude: (formData.longitude !== '' && !isNaN(formData.longitude)) ? parseFloat(formData.longitude) : null,
        description: formData.description,
        image_name: finalUrls[0], // 第一张作为封面（兼容旧逻辑）
        cover_image_url: finalUrls[0], // Admin 后台该酒吧的第一张封面图，与 schema 统一
        detail_images: finalUrls.slice(0, 5) // 全集作为详情图
      }

      if (editingId) {
        console.log('📡 发起更新请求, ID:', editingId);
        console.log('📦 更新数据:', barData);

        // 1. 更新酒吧主体信息
        const { data: updatedRows, error, status } = await memFire
          .from('bars')
          .update(barData)
          .eq('id', editingId)
          .select()
        
        if (error) {
          console.error('❌ MemFire 更新出错:', error);
          throw error
        }

        if (!updatedRows || updatedRows.length === 0) {
          console.warn('⚠️ 未找到匹配的记录进行更新, Status:', status);
          alert(`更新失败：未能在数据库中找到 ID 为 [${editingId}] 的酒吧记录。
          
这通常是因为：
1. 该酒吧已被删除。
2. MemFire 数据库的 RLS 策略限制了匿名修改。
          
请检查 MemFire 控制台的 Bars 表权限配置。`)
          return
        }

        console.log('✅ 酒吧信息更新成功:', updatedRows[0]);

        // 2. 🚨 核心修复：同步更新已发布的动态（collected_cards 表）
        // 如果名字发生了变化，我们需要把所有旧名字的动态都更新为新名字
        if (oldName && oldName !== formData.name) {
          console.log(`🔄 同步更新动态：从 "${oldName}" 改为 "${formData.name}"`)
          const { error: syncError } = await memFire
            .from('collected_cards')
            .update({ shop_name: formData.name })
            .eq('shop_name', oldName)
          
          if (syncError) {
            console.error('❌ 同步更新动态失败:', syncError)
            // 这里不 throw error，以免因为同步失败导致酒吧信息修改也回滚
          } else {
            console.log('✅ 动态名字同步成功')
          }
        }
        
        alert('✅ 修改成功！')
      } else {
        const { error } = await memFire.from('bars').insert([barData])
        if (error) throw error
        alert('🎉 录入成功！')
      }

      cancelEdit()
      fetchBars()
    } catch (err) {
      alert('保存失败: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除吗？')) return
    const { error } = await memFire.from('bars').delete().eq('id', id)
    if (error) alert('删除失败: ' + error.message)
    else fetchBars()
  }

  // 生成 8 位随机密码（避免 0/O、1/l 等易混字符）
  const generatePartnerPassword = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    setPartnerPassword(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
  }, [])

  const openPartnerAccountModal = (bar) => {
    setPartnerAccountModal({ show: true, bar })
    setPartnerError('')
    if (bar.owner_email || bar.owner_auth_id) {
      setPartnerEmail(bar.owner_email || '')
      setPartnerPassword(bar.owner_password || '')
    } else {
      setPartnerEmail('')
      setPartnerPassword('')
      generatePartnerPassword()
    }
  }

  const handleCreatePartnerAccount = async (e) => {
    e.preventDefault()
    if (!partnerAccountModal.bar) return
    const email = partnerEmail.trim()
    const emailTrim = email.toLowerCase()
    const password = partnerPassword || 'CupWorld888'
    if (!email) {
      setPartnerError('请输入商户邮箱')
      return
    }
    if (password.length < 6) {
      setPartnerError('密码至少 6 位')
      return
    }
    setPartnerSubmitting(true)
    setPartnerError('')
    try {
      const { error: updateError } = await memFire
        .from('bars')
        .update({ owner_email: emailTrim, owner_password: password })
        .eq('id', partnerAccountModal.bar.id)
      if (updateError) {
        setPartnerError('保存失败: ' + (updateError.message || ''))
        setPartnerSubmitting(false)
        return
      }
      alert('已保存，商户可使用该邮箱和密码登录商户后台。')
      setPartnerAccountModal({ show: false, bar: null })
      fetchBars()
    } catch (err) {
      setPartnerError(err?.message || '操作失败')
    } finally {
      setPartnerSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cc-neutral-50 flex items-center justify-center p-8 md:p-12">
        <div className="bg-cc-surface rounded-cc-2xl shadow-cc p-10 md:p-12 w-full max-w-[400px] border border-cc-border">
          <div className="flex flex-col items-center mb-10">
            <div className="mb-5">
              <img src="/logo.svg" alt="CupCup" className="w-12 h-12 rounded-cc-lg" />
            </div>
            <h1 className="text-2xl font-semibold text-cc-neutral-800 tracking-tight">CupCup Admin</h1>
            <p className="text-cc-neutral-500 text-sm font-serif mt-1.5">后台管理中心</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-cc-neutral-500 tracking-wide mb-1.5 ml-0.5">管理员账号</label>
              <input 
                required
                className="w-full bg-cc-neutral-50 border border-cc-border focus:border-cc-primary focus:ring-1 focus:ring-cc-primary/20 rounded-cc px-4 py-3 transition-all text-cc-neutral-800 placeholder:text-cc-neutral-400 outline-none"
                placeholder="请输入 ID"
                value={loginForm.id}
                onChange={e => setLoginForm({...loginForm, id: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-cc-neutral-500 tracking-wide mb-1.5 ml-0.5">安全密码</label>
              <input 
                required
                type="password"
                className="w-full bg-cc-neutral-50 border border-cc-border focus:border-cc-primary focus:ring-1 focus:ring-cc-primary/20 rounded-cc px-4 py-3 transition-all text-cc-neutral-800 placeholder:text-cc-neutral-400 outline-none"
                placeholder="请输入密码"
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
              />
            </div>
            <button className="w-full bg-cc-primary hover:bg-cc-primary-hover text-white font-medium py-3.5 rounded-cc transition-all">
              安全登录
            </button>
          </form>
          
          <p className="text-center text-cc-neutral-400 text-xs font-serif mt-10">© 2026 CupCup Technology Inc.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cc-neutral-50 pb-20">
      {/* 裁剪弹窗 */}
      {cropModal.show && (
        <div className="fixed inset-0 z-[100] bg-cc-neutral-900/40 flex flex-col items-center justify-center p-6">
          <div className="relative w-full max-w-xl aspect-square bg-cc-neutral-100 rounded-cc-2xl overflow-hidden shadow-2xl border border-cc-border">
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
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 className="animate-spin" size={32} />
              </div>
            )}
          </div>
          <div className="mt-8 w-full max-w-xl flex items-center gap-6">
            <input type="range" value={zoom} min={1} max={3} step={0.1} 
              onChange={(e) => setZoom(e.target.value)}
              className="flex-1 accent-indigo-500" />
            <div className="flex gap-3">
              <button onClick={() => setCropModal({ show: false, image: null, index: null })} 
                className="bg-cc-neutral-600 text-white px-6 py-3 rounded-cc-xl font-bold hover:bg-cc-neutral-700 transition-colors">取消</button>
              <button onClick={handleCropSave} 
                className="bg-cc-primary text-white px-8 py-3 rounded-cc-xl font-bold hover:bg-cc-primary-hover transition-all flex items-center gap-2">
                <Scissors size={18}/> 确认裁剪并保存
              </button>
            </div>
          </div>
          <p className="mt-4 text-cc-neutral-400 text-sm font-bold flex items-center gap-2">
            <Scissors size={14}/> 请选取正方形区域，系统将自动进行压缩优化
          </p>
        </div>
      )}

      {/* 生成商户登录账号弹窗：未设置邮箱时可编辑并保存到 bars；已设置则只读，仅关闭 */}
      {partnerAccountModal.show && partnerAccountModal.bar && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6" onClick={() => !partnerSubmitting && setPartnerAccountModal({ show: false, bar: null })}>
          <div className="bg-cc-surface rounded-cc-2xl shadow-2xl w-full max-w-md p-8" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-cc-neutral-800 mb-2 flex items-center gap-2">
              <UserPlus size={20} className="text-cc-success" /> {partnerAccountModal.bar.owner_email || partnerAccountModal.bar.owner_auth_id ? '商户登录账号' : '生成商户登录账号'}
            </h3>
            <p className="text-sm text-cc-neutral-500 mb-6">门店：{partnerAccountModal.bar.name}</p>

            {(partnerAccountModal.bar.owner_email || partnerAccountModal.bar.owner_auth_id) ? (
              /* 已绑定：只读显示 bars 表中的邮箱与密码，仅有关闭按钮 */
              <div className="space-y-4">
                <p className="text-sm text-cc-neutral-600">该门店已设置登录账号，以下为 bars 表中存储的邮箱与密码（只读）。</p>
                <div>
                  <label className="block text-xs font-bold text-cc-neutral-500 mb-1">登录邮箱</label>
                  <input type="text" readOnly value={partnerAccountModal.bar.owner_email || ''} className="w-full bg-cc-neutral-100 rounded-cc px-4 py-3 border border-cc-border text-cc-neutral-800" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cc-neutral-500 mb-1">登录密码</label>
                  <input
                    type="text"
                    readOnly
                    value={partnerPassword}
                    className="w-full bg-cc-neutral-100 rounded-cc px-4 py-3 border border-cc-border font-mono text-cc-neutral-800"
                  />
                </div>
                <div className="pt-2">
                  <button type="button" onClick={() => setPartnerAccountModal({ show: false, bar: null })} className="w-full bg-cc-neutral-100 text-cc-neutral-600 font-bold py-3 rounded-cc hover:bg-cc-neutral-200">
                    关闭
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreatePartnerAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-cc-neutral-500 mb-1">商户邮箱</label>
                  <input
                    type="email"
                    required
                    value={partnerEmail}
                    onChange={e => setPartnerEmail(e.target.value)}
                    placeholder="boss@coffee.com"
                    className="w-full bg-cc-neutral-100 rounded-cc px-4 py-3 border-0 focus:ring-2 focus:ring-cc-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cc-neutral-500 mb-1">初始密码（可修改）</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={partnerPassword}
                      onChange={e => setPartnerPassword(e.target.value)}
                      placeholder="8 位或使用 CupWorld888"
                      className="flex-1 bg-cc-neutral-100 rounded-cc px-4 py-3 border-0 focus:ring-2 focus:ring-cc-primary outline-none"
                    />
                    <button type="button" onClick={generatePartnerPassword} className="bg-cc-neutral-100 hover:bg-cc-neutral-200 text-cc-neutral-700 font-bold px-4 rounded-cc whitespace-nowrap">
                      随机生成
                    </button>
                  </div>
                </div>
                {partnerError && <p className="text-cc-error text-sm font-semibold">{partnerError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setPartnerAccountModal({ show: false, bar: null })} className="flex-1 bg-cc-neutral-100 text-cc-neutral-600 font-bold py-3 rounded-cc hover:bg-cc-neutral-200">
                    取消
                  </button>
                  <button type="submit" disabled={partnerSubmitting} className="flex-1 bg-cc-success text-white font-bold py-3 rounded-cc hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                    {partnerSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
                    {partnerSubmitting ? '创建中…' : '创建并绑定'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 顶部导航 */}
      <nav className="bg-cc-surface/80 backdrop-blur-sm border-b border-cc-border px-6 py-4 sticky top-0 z-50 flex items-center justify-between shadow-cc-sm">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="CupCup" className="w-8 h-8 rounded-cc shrink-0" />
          <h1 className="text-lg font-semibold text-cc-neutral-800 tracking-tight">CupCup 管理系统</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/admin/app-config"
            className="text-xs font-bold text-cc-primary hover:opacity-90 bg-cc-primary-subtle px-3 py-1.5 rounded-full flex items-center gap-1.5"
          >
            <Settings size={12} /> App 配置
          </Link>
          <Link
            to="/admin/audit-activities"
            className="text-xs font-bold text-cc-warning hover:opacity-90 bg-cc-warning-bg px-3 py-1.5 rounded-full flex items-center gap-1.5"
          >
            <FileText size={12} /> 活动审核
          </Link>
          <span className="text-xs font-bold text-cc-success bg-cc-success-bg px-3 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 size={12}/> 已连接 MemFire
          </span>
          <button 
            onClick={handleLogout}
            className="text-xs font-bold text-cc-neutral-500 hover:text-cc-error transition-colors flex items-center gap-1 bg-cc-neutral-100 px-3 py-1 rounded-full"
          >
            退出登录
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* 左侧：录入/编辑表单 */}
        <div className="lg:col-span-1">
          <div className={`bg-cc-surface rounded-cc-2xl shadow-lg border p-8 sticky top-28 transition-all ${editingId ? 'border-cc-primary ring-2 ring-cc-primary-subtle' : 'border-cc-border'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-cc-neutral-800 flex items-center gap-2">
                {editingId ? <Edit2 className="text-cc-primary" /> : <Plus className="text-cc-primary" />} 
                {editingId ? '修改店铺信息' : '录入新店铺'}
              </h2>
              {editingId && (
                <button onClick={cancelEdit} className="text-cc-neutral-500 hover:text-cc-error transition-colors">
                  <X size={20} />
                </button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-cc-neutral-500 mb-2">店铺名称</label>
                <input required className="w-full bg-cc-neutral-100 border-0 rounded-cc-xl px-4 py-3 focus:ring-2 focus:ring-cc-primary transition-all" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="输入酒吧名字..." />
              </div>

              <div>
                <label className="block text-sm font-bold text-cc-neutral-500 mb-2">店面分类</label>
                <select className="w-full bg-cc-neutral-100 border-0 rounded-cc-xl px-4 py-3" 
                  value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
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
                <label className="block text-sm font-bold text-cc-neutral-500 mb-2">详细地址</label>
                <input required className="w-full bg-cc-neutral-100 border-0 rounded-cc-xl px-4 py-3" 
                  value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="例如：北京市朝阳区..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-cc-neutral-500 mb-2">北纬 (Latitude)</label>
                  <input type="number" step="any" className="w-full bg-cc-neutral-100 border-0 rounded-cc-xl px-4 py-3" 
                    value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} placeholder="39.9324" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-cc-neutral-500 mb-2">东经 (Longitude)</label>
                  <input type="number" step="any" className="w-full bg-cc-neutral-100 border-0 rounded-cc-xl px-4 py-3" 
                    value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} placeholder="116.4553" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-cc-neutral-500 mb-2">介绍</label>
                <textarea rows={3} className="w-full bg-cc-neutral-100 border-0 rounded-cc-xl px-4 py-3 resize-none" 
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="描述一下这家店..." />
              </div>

              <div>
                <label className="block text-sm font-bold text-cc-neutral-500 mb-3">店铺照片 (最多 5 张，可拖拽调整顺序，第一张为封面图)</label>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {photoItems.map((item, idx) => (
                    <PhotoItem
                      key={`photo-${idx}`}
                      item={item}
                      index={idx}
                      isFirst={idx === 0}
                      onRemove={removeFile}
                      onDragStart={setPhotoDragIndex}
                      onDrop={handlePhotoDrop}
                      isDragging={photoDragIndex === idx}
                    />
                  ))}
                  {photoItems.length < 5 && (
                    <label className="cursor-pointer aspect-square border-2 border-dashed border-cc-border rounded-cc flex flex-col items-center justify-center hover:border-cc-primary hover:bg-cc-primary-subtle transition-all text-cc-neutral-500">
                      <Plus size={24} />
                      <span className="text-[10px] font-bold mt-1">添加照片</span>
                      <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="flex-1 bg-cc-neutral-100 hover:bg-cc-neutral-200 text-cc-neutral-600 font-bold py-4 rounded-cc-xl transition-all">
                    取消
                  </button>
                )}
                <button disabled={isSubmitting} className={`flex-[2] text-white font-bold py-4 rounded-cc-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${editingId ? 'bg-cc-primary hover:bg-cc-primary-hover' : 'bg-cc-primary hover:bg-cc-primary-hover'}`}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : editingId ? '确认修改' : '立即发布到 App'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 右侧：已发布酒吧列表（可拖拽排序） */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-extrabold text-cc-neutral-800">已发布的酒吧</h2>
            <div className="flex items-center gap-3">
              {barsSavingOrder && <span className="text-xs text-cc-warning font-bold flex items-center gap-1"><Loader2 className="animate-spin" size={14} /> 保存顺序中…</span>}
              <button onClick={fetchBars} className="text-sm font-bold text-cc-primary">刷新</button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cc-neutral-300" size={40} /></div>
          ) : bars.length === 0 ? (
            <div className="bg-cc-surface rounded-cc-2xl p-20 text-center border border-dashed border-cc-border text-cc-neutral-500 font-bold">
              <AlertCircle className="mx-auto mb-2" /> 还没有录入过酒吧，快从左侧开始吧！
            </div>
          ) : (
            <div className="space-y-3">
              {bars.map((bar, index) => (
                <BarRow
                  key={bar.id}
                  bar={bar}
                  index={index}
                  isEditing={editingId === bar.id}
                  formName={formData.name}
                  formCategory={formData.category}
                  formAddress={formData.address}
                  coverPreviewUrl={photoItems[0] ? (photoItems[0].type === 'existing' ? photoItems[0].url : photoItems[0].previewUrl) : (bar.cover_image_url || bar.image_name)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPartnerAccount={openPartnerAccountModal}
                  onDragStart={setBarDragIndex}
                  onDrop={handleBarDrop}
                  isDragging={barDragIndex === index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
