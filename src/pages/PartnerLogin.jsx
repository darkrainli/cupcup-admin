/**
 * 商户登录页：邮箱 + 密码登录，成功后根据 auth id 拉取 bar 并缓存 bar_id，跳转发布页
 */
import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Wine, Loader2, Mail, Lock } from 'lucide-react'
import { usePartnerAuth } from '../context/PartnerAuthContext'

export default function PartnerLogin() {
  const navigate = useNavigate()
  const { login, isPartnerLoggedIn, loading } = usePartnerAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 已登录且已有 bar_id 则直接进发布页
  if (isPartnerLoggedIn) {
    return <Navigate to="/partner/create-activity" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate('/partner/create-activity', { replace: true })
    } catch (err) {
      setError(err?.message || '登录失败，请检查邮箱与密码')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl border border-white/20 p-8 md:p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-500/30 mb-4">
              <Wine size={40} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">商户后台</h1>
            <p className="text-slate-500 text-sm font-semibold mt-1">CupWorld Partner · 邮箱登录</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Mail size={14} /> 邮箱
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3.5 transition-all font-medium text-slate-700 outline-none"
                  placeholder="boss@coffee.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Lock size={14} /> 密码
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3.5 transition-all font-medium text-slate-700 outline-none"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <div className="text-red-600 text-sm font-semibold bg-red-50 rounded-xl px-4 py-2.5">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={20} /> : null}
                {submitting ? '登录中…' : '登录'}
              </button>
            </form>
          )}

          <p className="text-center text-slate-400 text-xs font-medium mt-8">
            登录即表示您已绑定门店，可发布黑卡专属活动
          </p>
        </div>
      </div>
    </div>
  )
}
