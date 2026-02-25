import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Plus, Trash2, MapPin, Wine, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle, Edit2, X, Scissors } from 'lucide-react'
import Cropper from 'react-easy-crop'
import imageCompression from 'browser-image-compression'

// CupCup 酒吧管理后台：对接 MemFire（CupStation 店铺数据）
// 登录账号：cupadmin  密码：cup9898
// 接口：bars 表、collected_cards 表、Storage 桶 cup-images（bar-details）
const MEMFIRE_URL = import.meta.env.VITE_MEMFIRE_URL || "https://d647ojgg91hgk1gnpfqg.baseapi.memfiredb.com"
const MEMFIRE_ANON_KEY = import.meta.env.VITE_MEMFIRE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImV4cCI6MzM0NzM1MjM5OCwiaWF0IjoxNzcwNTUyMzk4LCJpc3MiOiJzdXBhYmFzZSJ9.jWRdDqRdG9hx0UCDtHdM6xmUmmALuxFaQoaaLbIpmmU"
const memFire = createClient(MEMFIRE_URL, MEMFIRE_ANON_KEY)

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

function App() {
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
    description: '',
    imageFiles: [] 
  })

  // 预览状态
  const [previews, setPreviews] = useState({ 
    images: [], 
    existingImages: [] 
  })

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
      const { data, error } = await memFire
        .from('bars')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setBars(data || [])
    } catch (error) {
      console.error('Error fetching bars:', error)
      alert('获取酒吧列表失败，请检查网络连接')
    } finally {
      setLoading(false)
    }
  }

  // 1. 处理原始图片选择 -> 触发裁剪
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (formData.imageFiles.length + previews.existingImages.length >= 5) {
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

      const updatedFiles = [...formData.imageFiles, file]
      const updatedPreviews = [...previews.images, URL.createObjectURL(file)]
      
      setFormData({ ...formData, imageFiles: updatedFiles })
      setPreviews({ ...previews, images: updatedPreviews })
      setCropModal({ show: false, image: null, index: null })
    } catch (e) {
      console.error(e)
      alert('裁剪/压缩失败')
    }
  }

  const removeFile = (index, isExisting = false) => {
    if (isExisting) {
      const updated = [...previews.existingImages]
      updated.splice(index, 1)
      setPreviews({ ...previews, existingImages: updated })
    } else {
      const updatedFiles = [...formData.imageFiles]
      updatedFiles.splice(index, 1)
      const updatedPreviews = [...previews.images]
      updatedPreviews.splice(index, 1)
      setFormData({ ...formData, imageFiles: updatedFiles })
      setPreviews({ ...previews, images: updatedPreviews })
    }
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
      description: bar.description || '',
      imageFiles: []
    })
    setPreviews({
      images: [],
      existingImages: bar.detail_images && bar.detail_images.length > 0 ? bar.detail_images : [bar.image_name]
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFormData({ name: '', category: '鸡尾酒吧', address: '', latitude: '', longitude: '', description: '', imageFiles: [] })
    setPreviews({ images: [], existingImages: [] })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // 检查是否有图片（新传的或原本有的）
    const totalImages = formData.imageFiles.length + previews.existingImages.length
    if (totalImages === 0) return alert('请至少上传一张照片')
    
    setIsSubmitting(true)

    try {
      // 1. 上传新图片
      let finalUrls = [...previews.existingImages]
      if (formData.imageFiles.length > 0) {
        const newUrls = []
        for (const file of formData.imageFiles) {
          const url = await uploadFile(file, 'bar-details')
          newUrls.push(url)
        }
        finalUrls = [...finalUrls, ...newUrls].slice(0, 5) // 保持 5 张
      }

      // 2. 准备数据：第一张设为 image_name，全集设为 detail_images
      const barData = {
        name: formData.name,
        category: formData.category,
        address: formData.address,
        latitude: (formData.latitude !== '' && !isNaN(formData.latitude)) ? parseFloat(formData.latitude) : null,
        longitude: (formData.longitude !== '' && !isNaN(formData.longitude)) ? parseFloat(formData.longitude) : null,
        description: formData.description,
        image_name: finalUrls[0], // 第一张作为封面
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-[40px] shadow-2xl p-10 w-full max-w-md border border-slate-100">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-indigo-600 p-4 rounded-3xl text-white mb-4 shadow-xl shadow-indigo-200">
              <Wine size={40} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">CupCup Admin</h1>
            <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">后台管理中心</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">管理员账号</label>
              <input 
                required
                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-5 py-4 transition-all font-bold text-slate-700 outline-none"
                placeholder="请输入 ID"
                value={loginForm.id}
                onChange={e => setLoginForm({...loginForm, id: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">安全密码</label>
              <input 
                required
                type="password"
                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-5 py-4 transition-all font-bold text-slate-700 outline-none"
                placeholder="请输入密码"
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
              />
            </div>
            <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-3xl shadow-xl shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-[0.98]">
              安全登录
            </button>
          </form>
          
          <p className="text-center text-slate-300 text-xs font-bold mt-10">© 2026 CupCup Technology Inc.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* 裁剪弹窗 */}
      {cropModal.show && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6">
          <div className="relative w-full max-w-xl aspect-square bg-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <Cropper
              image={cropModal.image}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="mt-8 w-full max-w-xl flex items-center gap-6">
            <input type="range" value={zoom} min={1} max={3} step={0.1} 
              onChange={(e) => setZoom(e.target.value)}
              className="flex-1 accent-indigo-500" />
            <div className="flex gap-3">
              <button onClick={() => setCropModal({ show: false, image: null, index: null })} 
                className="bg-slate-700 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-600 transition-colors">取消</button>
              <button onClick={handleCropSave} 
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all flex items-center gap-2">
                <Scissors size={18}/> 确认裁剪并保存
              </button>
            </div>
          </div>
          <p className="mt-4 text-slate-400 text-sm font-bold flex items-center gap-2">
            <Scissors size={14}/> 请选取正方形区域，系统将自动进行压缩优化
          </p>
        </div>
      )}
      {/* 顶部导航 */}
      <nav className="bg-white border-b px-6 py-4 sticky top-0 z-50 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-xl text-white"><Wine size={24}/></div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">CupCup 管理系统</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-green-500 bg-green-50 px-3 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 size={12}/> 已连接 MemFire
          </span>
          <button 
            onClick={handleLogout}
            className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full"
          >
            退出登录
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* 左侧：录入/编辑表单 */}
        <div className="lg:col-span-1">
          <div className={`bg-white rounded-3xl shadow-xl border p-8 sticky top-28 transition-all ${editingId ? 'border-indigo-500 ring-2 ring-indigo-50' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {editingId ? <Edit2 className="text-indigo-600" /> : <Plus className="text-indigo-600" />} 
                {editingId ? '修改酒吧信息' : '录入新酒吧'}
              </h2>
              {editingId && (
                <button onClick={cancelEdit} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X size={20} />
                </button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">酒吧名称</label>
                <input required className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="输入酒吧名字..." />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">店面分类</label>
                <select className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3" 
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
                <label className="block text-sm font-bold text-slate-500 mb-2">详细地址</label>
                <input required className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3" 
                  value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="例如：北京市朝阳区..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">北纬 (Latitude)</label>
                  <input type="number" step="any" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3" 
                    value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} placeholder="39.9324" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">东经 (Longitude)</label>
                  <input type="number" step="any" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3" 
                    value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} placeholder="116.4553" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">介绍</label>
                <textarea rows={3} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 resize-none" 
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="描述一下这家店..." />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 mb-3">酒吧照片 (最多 5 张，第一张将作为封面图)</label>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {/* 已有图片预览 (编辑模式) */}
                  {previews.existingImages.map((url, idx) => (
                    <div key={`existing-${idx}`} className="relative aspect-square group">
                      <img src={url} className="w-full h-full object-cover rounded-xl border border-slate-200" />
                      <button type="button" onClick={() => removeFile(idx, true)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={12} />
                      </button>
                      {idx === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 text-white text-[10px] font-black text-center py-1 rounded-b-xl">封面图</div>
                      )}
                    </div>
                  ))}

                  {/* 新选择图片预览 */}
                  {previews.images.map((url, idx) => {
                    const isFirstGlobal = previews.existingImages.length === 0 && idx === 0;
                    return (
                      <div key={`new-${idx}`} className="relative aspect-square group">
                        <img src={url} className="w-full h-full object-cover rounded-xl border border-indigo-200" />
                        <button type="button" onClick={() => removeFile(idx, false)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={12} />
                        </button>
                        {isFirstGlobal && (
                          <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 text-white text-[10px] font-black text-center py-1 rounded-b-xl">封面图</div>
                        )}
                      </div>
                    );
                  })}

                  {/* 添加按钮 */}
                  {(previews.images.length + previews.existingImages.length) < 5 && (
                    <label className="cursor-pointer aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center hover:border-indigo-400 hover:bg-indigo-50 transition-all text-slate-400">
                      <Plus size={24} />
                      <span className="text-[10px] font-bold mt-1">添加照片</span>
                      <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all">
                    取消
                  </button>
                )}
                <button disabled={isSubmitting} className={`flex-[2] text-white font-black py-4 rounded-2xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${editingId ? 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : editingId ? '确认修改' : '立即发布到 App'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 右侧：酒吧列表 */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-slate-800">已发布的酒吧</h2>
            <button onClick={fetchBars} className="text-sm font-bold text-indigo-600">刷新</button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300" size={40} /></div>
          ) : bars.length === 0 ? (
            <div className="bg-white rounded-3xl p-20 text-center border border-dashed text-slate-400 font-bold">
              <AlertCircle className="mx-auto mb-2" /> 还没有录入过酒吧，快从左侧开始吧！
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bars.map(bar => (
                <div key={bar.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden group relative transition-all ${editingId === bar.id ? 'border-indigo-400 ring-2 ring-indigo-50' : 'border-slate-100'}`}>
                  <div className="aspect-[16/10] overflow-hidden">
                    <img 
                      src={editingId === bar.id ? (previews.images[0] || previews.existingImages[0] || bar.image_name) : bar.image_name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-black text-slate-800 text-lg">
                        {editingId === bar.id ? (formData.name || '未命名酒吧') : bar.name}
                      </h3>
                      <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-lg font-black text-slate-500 uppercase tracking-wider">
                        {editingId === bar.id ? formData.category : bar.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mb-4">
                      <MapPin size={12}/> {editingId === bar.id ? (formData.address || '未填写地址') : bar.address}
                    </p>
                    
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4">
                      <button onClick={() => handleEdit(bar)} className="bg-white text-indigo-600 p-2 rounded-xl shadow-lg hover:bg-indigo-50 transition-colors">
                        <Edit2 size={16}/>
                      </button>
                      <button onClick={() => handleDelete(bar.id)} className="bg-red-500 text-white p-2 rounded-xl shadow-lg hover:bg-red-600 transition-colors">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
