/**
 * App 配置：杯子识别大模型（第 2～3 层）
 * 读/写 app_config 表：cup_llm_without_nfc、cup_llm_with_nfc
 * 约定：docs/cup_llm_config_layer0.md
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Wine, Loader2, Save, CheckCircle2, Settings, CalendarCheck, Plus, Trash2 } from 'lucide-react'
import { memFire } from '../lib/memfire'

const PLATFORMS = [
  { value: 'zhipu', label: '智谱' },
  { value: 'qwen', label: '通义' },
  { value: 'doubao', label: '豆包' },
  { value: 'qianfan', label: '百度千帆' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'openai', label: 'ChatGPT' }
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
  const [zhipuApiKey, setZhipuApiKey] = useState('')
  const [qwenApiKey, setQwenApiKey] = useState('')
  const [doubaoApiKey, setDoubaoApiKey] = useState('')
  const [qianfanApiKey, setQianfanApiKey] = useState('')
  const [deepseekApiKey, setDeepseekApiKey] = useState('')
  const [claudeApiKey, setClaudeApiKey] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [dailyCheckInLimit, setDailyCheckInLimit] = useState('')
  const [userCheckInLimits, setUserCheckInLimits] = useState([])

  useEffect(() => {
    if (!isAuthenticated) return
    loadConfig()
  }, [isAuthenticated])

  const loadConfig = async () => {
    setLoading(true)
    setError('')
    try {
      const configKeys = [
        'cup_llm_without_nfc', 'cup_llm_with_nfc',
        'zhipu_api_key', 'qwen_api_key', 'doubao_api_key', 'qianfan_api_key',
        'deepseek_api_key', 'claude_api_key', 'gemini_api_key', 'openai_api_key',
        'daily_checkin_limit', 'user_checkin_limits'
      ]
      const { data, error: err } = await memFire
        .from('app_config')
        .select('key, value')
        .in('key', configKeys)
      if (err) throw err
      const map = (data || []).reduce((acc, row) => {
        acc[row.key] = row.value
        return acc
      }, {})
      setWithoutNfc(parseValue(map.cup_llm_without_nfc))
      setWithNfc(parseValue(map.cup_llm_with_nfc))
      setZhipuApiKey(map.zhipu_api_key ?? '')
      setQwenApiKey(map.qwen_api_key ?? '')
      setDoubaoApiKey(map.doubao_api_key ?? '')
      setQianfanApiKey(map.qianfan_api_key ?? '')
      setDeepseekApiKey(map.deepseek_api_key ?? '')
      setClaudeApiKey(map.claude_api_key ?? '')
      setGeminiApiKey(map.gemini_api_key ?? '')
      setOpenaiApiKey(map.openai_api_key ?? '')
      setDailyCheckInLimit(map.daily_checkin_limit ?? '')
      try {
        const raw = map.user_checkin_limits ?? '{}'
        const obj = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw
        setUserCheckInLimits(
          Object.entries(obj).map(([userId, limit]) => ({ userId: String(userId), limit: Number(limit) || 1 }))
        )
      } catch {
        setUserCheckInLimits([])
      }
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
    const now = new Date().toISOString()
    const dailyLimitValue = dailyCheckInLimit === '0' ? '' : (dailyCheckInLimit || '')
    const userLimitsObj = userCheckInLimits
      .filter(({ userId }) => String(userId).trim())
      .reduce((acc, { userId, limit }) => {
        acc[String(userId).trim()] = Math.min(20, Math.max(1, Number(limit) || 1))
        return acc
      }, {})
    const userCheckInLimitsValue = JSON.stringify(userLimitsObj)
    try {
      await memFire.from('app_config').upsert(
        [
          { key: 'cup_llm_without_nfc', value: v1, updated_at: now },
          { key: 'cup_llm_with_nfc', value: v2, updated_at: now },
          { key: 'zhipu_api_key', value: zhipuApiKey.trim(), updated_at: now },
          { key: 'qwen_api_key', value: qwenApiKey.trim(), updated_at: now },
          { key: 'doubao_api_key', value: doubaoApiKey.trim(), updated_at: now },
          { key: 'qianfan_api_key', value: qianfanApiKey.trim(), updated_at: now },
          { key: 'deepseek_api_key', value: deepseekApiKey.trim(), updated_at: now },
          { key: 'claude_api_key', value: claudeApiKey.trim(), updated_at: now },
          { key: 'gemini_api_key', value: geminiApiKey.trim(), updated_at: now },
          { key: 'openai_api_key', value: openaiApiKey.trim(), updated_at: now },
          { key: 'daily_checkin_limit', value: dailyLimitValue, updated_at: now },
          { key: 'user_checkin_limits', value: userCheckInLimitsValue, updated_at: now }
        ],
        { onConflict: 'key' }
      )
      setSuccess('已保存。App 将使用新配置与 API Key（Key 留空时 App 使用内置兜底）。')
    } catch (e) {
      setError('保存失败: ' + (e?.message || ''))
    } finally {
      setSaving(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cc-neutral-50 flex items-center justify-center p-6">
        <p className="text-cc-neutral-500 font-bold">请先<a href="/" className="text-cc-primary underline">登录管理后台</a>后再访问此页。</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cc-neutral-50 pb-20">
      <nav className="bg-cc-surface/80 backdrop-blur-sm border-b border-cc-border px-6 py-4 sticky top-0 z-50 flex items-center justify-between shadow-cc-sm">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="CupCup" className="w-8 h-8 rounded-cc shrink-0" />
          <h1 className="text-lg font-semibold text-cc-neutral-800 tracking-tight">CupCup 管理系统</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xs font-bold text-cc-neutral-500 hover:text-cc-neutral-700">返回门店管理</Link>
          <Link to="/admin/audit-activities" className="text-xs font-bold text-cc-warning hover:opacity-90 bg-cc-warning-bg px-3 py-1.5 rounded-full flex items-center gap-1.5">
            活动审核
          </Link>
          <span className="text-xs font-bold text-cc-success bg-cc-success-bg px-3 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 size={12} /> 已连接 MemFire
          </span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="text-cc-primary" size={22} strokeWidth={1.5} />
          <h2 className="text-xl font-semibold text-cc-neutral-800">App 配置</h2>
        </div>
        <p className="text-cc-neutral-500 text-sm font-serif mb-8">配置杯子识别使用的大模型，不依赖 App 发版即可切换。</p>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cc-neutral-300" size={40} /></div>
        ) : (
          <form onSubmit={handleSave} className="space-y-8">
            {error && <div className="bg-cc-error-bg text-cc-error px-4 py-3 rounded-cc-xl text-sm font-bold">{error}</div>}
            {success && <div className="bg-cc-success-bg text-cc-success px-4 py-3 rounded-cc-xl text-sm font-bold">{success}</div>}

            {CONFIG_KEYS.map(({ key, title, desc }) => {
              const isWithout = key === 'cup_llm_without_nfc'
              const state = isWithout ? withoutNfc : withNfc
              const setState = isWithout ? setWithoutNfc : setWithNfc
              return (
                <div key={key} className="bg-cc-surface rounded-cc-2xl border border-cc-border shadow-sm p-6">
                  <h3 className="font-bold text-cc-neutral-800 mb-1">{title}</h3>
                  <p className="text-xs text-cc-neutral-500 mb-4">{desc}</p>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="min-w-[120px]">
                      <label className="block text-xs font-bold text-cc-neutral-500 mb-1">平台</label>
                      <select
                        value={PLATFORMS.some(p => p.value === state.platform) ? state.platform : 'zhipu'}
                        onChange={e => setState({ ...state, platform: e.target.value })}
                        className="w-full bg-cc-neutral-100 border-0 rounded-cc px-4 py-3 focus:ring-2 focus:ring-cc-primary outline-none font-medium text-cc-neutral-800"
                      >
                        {PLATFORMS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-xs font-bold text-cc-neutral-500 mb-1">模型名称</label>
                      <input
                        type="text"
                        value={state.model}
                        onChange={e => setState({ ...state, model: e.target.value })}
                        placeholder="如 glm-4.6v、qwen-vl-max"
                        className="w-full bg-cc-neutral-100 border-0 rounded-cc px-4 py-3 focus:ring-2 focus:ring-cc-primary outline-none font-medium text-cc-neutral-800 placeholder:text-cc-neutral-400"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-cc-neutral-500">保存后将写入为：{buildValue(state.platform, state.model) || '—'}</p>
                </div>
              )
            })}

            <div className="bg-cc-surface rounded-cc-2xl border border-cc-border shadow-sm p-6">
              <div className="flex items-center gap-2 mb-1">
                <CalendarCheck className="text-cc-primary" size={20} />
                <h3 className="font-bold text-cc-neutral-800">每日打卡次数限制</h3>
              </div>
              <p className="text-xs text-cc-neutral-500 mb-4">全局上限：不设限或 1～20 次/天。达限后用户打开拍照界面会提示「请您明天再来」。</p>
              <div className="mb-6">
                <label className="block text-xs font-bold text-cc-neutral-500 mb-1">全局每日打卡上限</label>
                <select
                  value={dailyCheckInLimit === '0' ? '' : dailyCheckInLimit}
                  onChange={e => setDailyCheckInLimit(e.target.value === '' ? '' : e.target.value)}
                  className="w-full max-w-[200px] bg-cc-neutral-100 border-0 rounded-cc px-4 py-3 focus:ring-2 focus:ring-cc-primary outline-none font-medium text-cc-neutral-800"
                >
                  <option value="">不设限</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(n => (
                    <option key={n} value={String(n)}>{n} 次/天</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-cc-neutral-500 mb-2">指定用户限次（覆盖全局）</label>
                <p className="text-xs text-cc-neutral-500 mb-3">为指定 user_id 设置单独的每日上限，如被报警用户。留空或删除即使用全局上限。</p>
                <div className="space-y-3">
                  {userCheckInLimits.map((row, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={row.userId}
                        onChange={e => {
                          const next = [...userCheckInLimits]
                          next[idx] = { ...next[idx], userId: e.target.value }
                          setUserCheckInLimits(next)
                        }}
                        placeholder="user_id"
                        className="w-32 bg-cc-neutral-100 border-0 rounded-cc px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-cc-primary outline-none text-cc-neutral-800 placeholder:text-cc-neutral-400"
                      />
                      <span className="text-cc-neutral-500 text-sm">→</span>
                      <select
                        value={row.limit}
                        onChange={e => {
                          const next = [...userCheckInLimits]
                          next[idx] = { ...next[idx], limit: Number(e.target.value) }
                          setUserCheckInLimits(next)
                        }}
                        className="bg-cc-neutral-100 border-0 rounded-cc px-3 py-2 text-sm font-medium text-cc-neutral-800 focus:ring-2 focus:ring-cc-primary outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(n => (
                          <option key={n} value={n}>{n} 次/天</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setUserCheckInLimits(userCheckInLimits.filter((_, i) => i !== idx))}
                        className="p-2 rounded-lg text-cc-neutral-500 hover:bg-cc-error-bg hover:text-cc-error"
                        title="删除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setUserCheckInLimits([...userCheckInLimits, { userId: '', limit: 1 }])}
                    className="flex items-center gap-1.5 text-sm font-bold text-cc-primary hover:opacity-90"
                  >
                    <Plus size={16} /> 添加一条
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-cc-surface rounded-cc-2xl border border-cc-border shadow-sm p-6">
              <h3 className="font-bold text-cc-neutral-800 mb-1">API Key 配置</h3>
              <p className="text-xs text-cc-neutral-500 mb-4">在管理端配置后，可随时更换 Key，无需发版审核。留空则 App 使用内置兜底（仅智谱/通义有兜底）。</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'zhipu', label: '智谱', value: zhipuApiKey, set: setZhipuApiKey },
                  { key: 'qwen', label: '通义', value: qwenApiKey, set: setQwenApiKey },
                  { key: 'doubao', label: '豆包', value: doubaoApiKey, set: setDoubaoApiKey },
                  { key: 'qianfan', label: '百度千帆', value: qianfanApiKey, set: setQianfanApiKey },
                  { key: 'deepseek', label: 'DeepSeek', value: deepseekApiKey, set: setDeepseekApiKey },
                  { key: 'claude', label: 'Claude', value: claudeApiKey, set: setClaudeApiKey },
                  { key: 'gemini', label: 'Gemini', value: geminiApiKey, set: setGeminiApiKey },
                  { key: 'openai', label: 'ChatGPT', value: openaiApiKey, set: setOpenaiApiKey }
                ].map(({ key, label, value, set }) => (
                  <div key={key}>
                    <label className="block text-xs font-bold text-cc-neutral-500 mb-1">{label} API Key</label>
                    <input
                      type="password"
                      value={value}
                      onChange={e => set(e.target.value)}
                      placeholder="留空则使用内置兜底"
                      className="w-full bg-cc-neutral-100 border-0 rounded-cc px-4 py-3 focus:ring-2 focus:ring-cc-primary outline-none font-mono text-cc-neutral-800 placeholder:text-cc-neutral-400 text-sm"
                      autoComplete="off"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-cc-primary hover:bg-cc-primary-hover text-white font-bold py-4 rounded-cc-xl disabled:opacity-50 flex items-center justify-center gap-2"
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
