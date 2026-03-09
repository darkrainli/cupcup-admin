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
    return <Navigate to="/partner/dashboard" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate('/partner/dashboard', { replace: true })
    } catch (err) {
      setError(err?.message || '登录失败，请检查邮箱与密码')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-cc-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-cc-surface rounded-cc-2xl shadow-lg border border-cc-border p-8 md:p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-cc-primary p-4 rounded-cc-xl text-white mb-4 shadow-lg">
              <Wine size={40} />
            </div>
            <h1 className="text-2xl font-extrabold text-cc-neutral-800 tracking-tight">商户后台</h1>
            <p className="text-cc-neutral-500 text-sm font-semibold mt-1">CupWorld Partner · 邮箱登录</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-cc-primary" size={32} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-cc-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Mail size={14} /> 邮箱
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full bg-cc-neutral-100 border-2 border-transparent focus:border-cc-primary focus:bg-cc-surface rounded-cc-xl px-4 py-3.5 transition-all font-medium text-cc-neutral-700 outline-none"
                  placeholder="boss@coffee.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-cc-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Lock size={14} /> 密码
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full bg-cc-neutral-100 border-2 border-transparent focus:border-cc-primary focus:bg-cc-surface rounded-cc-xl px-4 py-3.5 transition-all font-medium text-cc-neutral-700 outline-none"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <div className="text-cc-error text-sm font-semibold bg-cc-error-bg rounded-cc px-4 py-2.5">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-cc-primary hover:bg-cc-primary-hover disabled:opacity-60 text-white font-bold py-4 rounded-cc-xl transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={20} /> : null}
                {submitting ? '登录中…' : '登录'}
              </button>
            </form>
          )}

          <p className="text-center text-cc-neutral-500 text-xs font-medium mt-8">
            登录即表示您已绑定门店，可发布黑卡专属活动
          </p>
        </div>
      </div>
    </div>
  )
}
