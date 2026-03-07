/**
 * App 配置：杯子识别大模型（第 2～3 层）
 * 读/写 app_config 表：cup_llm_without_nfc、cup_llm_with_nfc
 * 约定：docs/cup_llm_config_layer0.md
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Wine, Loader2, Save, CheckCircle2, Settings } from 'lucide-react'
import { memFire } from '../lib/memfire'

const PLATFORMS = [
  { value: 'zhipu', label: '智谱' },
  { value: 'qwen', label: '通义' },
  { value: 'doubao', label: '豆包' }
]

function parseValue(value) {
  if (!value || typeof value !== 'string') return { platform: 'zhipu', model: '' }
  const idx = value.indexOf('/')
  if (idx === -1) return { platform: 'zhipu', model: value.trim() }
  return {
    platform: value.slice(0, idx).trim() || 'zhipu',
    model: value.slice(idx + 1).trim()
  }
}

function buildValue(platform, model) {
  const p = (platform || 'zhipu').trim()
  const m = (model || '').trim()
  if (!m) return ''
  return `${p}/${m}`
}

function validateValue(value) {
  if (!value || value.length > 128) return false
  const parts = value.split('/')
  return parts.length === 2 && parts[0].trim() && parts[1].trim()
}

const CONFIG_KEYS = [
  { key: 'cup_llm_without_nfc', title: '不带 NFC 的拍杯流程', desc: '拍杯打卡等入口，拍杯后直接出结果' },
  { key: 'cup_llm_with_nfc', title: '带 NFC 的拍杯流程', desc: 'NFC 打卡入口，拍杯后进入 NFC 出示页核销' }
]

export default function AppConfig() {
  const [isAuthenticated] = useState(localStorage.getItem('isLoggedIn') === 'true')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [withoutNfc, setWithoutNfc] = useState({ platform: 'zhipu', model: 'glm-4.6v' })
  const [withNfc, setWithNfc] = useState({ platform: 'zhipu', model: 'glm-4.6v' })

  useEffect(() => {
    if (!isAuthenticated) return
    loadConfig()
  }, [isAuthenticated])

  const loadConfig = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await memFire
        .from('app_config')
        .select('key, value')
        .in('key', ['cup_llm_without_nfc', 'cup_llm_with_nfc'])
      if (err) throw err
      const map = (data || []).reduce((acc, row) => {
        acc[row.key] = row.value
        return acc
      }, {})
      setWithoutNfc(parseValue(map.cup_llm_without_nfc))
      setWithNfc(parseValue(map.cup_llm_with_nfc))
    } catch (e) {
      setError('加载配置失败: ' + (e?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const v1 = buildValue(withoutNfc.platform, withoutNfc.model)
    const v2 = buildValue(withNfc.platform, withNfc.model)
    if (!validateValue(v1)) {
      setError('请填写「不带 NFC」的模型名称（平台/模型格式）')
      return
    }
    if (!validateValue(v2)) {
      setError('请填写「带 NFC」的模型名称（平台/模型格式）')
      return
    }
    setSaving(true)
    try {
      await memFire.from('app_config').update({ value: v1, updated_at: new Date().toISOString() }).eq('key', 'cup_llm_without_nfc')
      await memFire.from('app_config').update({ value: v2, updated_at: new Date().toISOString() }).eq('key', 'cup_llm_with_nfc')
      setSuccess('已保存，App 将按新配置调用识别模型。')
    } catch (e) {
      setError('保存失败: ' + (e?.message || ''))
    } finally {
      setSaving(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-500 font-bold">请先<a href="/" className="text-indigo-600 underline">登录管理后台</a>后再访问此页。</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <nav className="bg-white border-b px-6 py-4 sticky top-0 z-50 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-xl text-white"><Wine size={24} /></div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">CupCup 管理系统</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xs font-bold text-slate-500 hover:text-slate-700">返回门店管理</Link>
          <Link to="/admin/audit-activities" className="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            活动审核
          </Link>
          <span className="text-xs font-bold text-green-500 bg-green-50 px-3 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 size={12} /> 已连接 MemFire
          </span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="text-indigo-600" size={24} />
          <h2 className="text-2xl font-black text-slate-800">App 配置</h2>
        </div>
        <p className="text-slate-500 text-sm mb-8">配置杯子识别使用的大模型，不依赖 App 发版即可切换。</p>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300" size={40} /></div>
        ) : (
          <form onSubmit={handleSave} className="space-y-8">
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-2xl text-sm font-bold">{error}</div>}
            {success && <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-2xl text-sm font-bold">{success}</div>}

            {CONFIG_KEYS.map(({ key, title, desc }) => {
              const isWithout = key === 'cup_llm_without_nfc'
              const state = isWithout ? withoutNfc : withNfc
              const setState = isWithout ? setWithoutNfc : setWithNfc
              return (
                <div key={key} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 mb-1">{title}</h3>
                  <p className="text-xs text-slate-400 mb-4">{desc}</p>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="min-w-[120px]">
                      <label className="block text-xs font-bold text-slate-500 mb-1">平台</label>
                      <select
                        value={PLATFORMS.some(p => p.value === state.platform) ? state.platform : 'zhipu'}
                        onChange={e => setState({ ...state, platform: e.target.value })}
                        className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
                      >
                        {PLATFORMS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-xs font-bold text-slate-500 mb-1">模型名称</label>
                      <input
                        type="text"
                        value={state.model}
                        onChange={e => setState({ ...state, model: e.target.value })}
                        placeholder="如 glm-4.6v、qwen-vl-max"
                        className="w-full bg-slate-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">保存后将写入为：{buildValue(state.platform, state.model) || '—'}</p>
                </div>
              )
            })}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {saving ? '保存中…' : '保存配置'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
