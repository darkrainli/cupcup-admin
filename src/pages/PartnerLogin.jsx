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
    <div className="min-h-screen bg-cc-neutral-50 flex items-center justify-center p-8 md:p-12">
      <div className="w-full max-w-[400px]">
        <div className="bg-cc-surface rounded-cc-2xl shadow-cc border border-cc-border p-10 md:p-12">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-cc-primary/10 text-cc-primary p-4 rounded-cc-lg mb-5">
              <Wine size={36} strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-semibold text-cc-neutral-800 tracking-tight">商户后台</h1>
            <p className="text-cc-neutral-500 text-sm font-serif mt-1.5">CupWorld Partner · 邮箱登录</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="animate-spin text-cc-primary" size={28} strokeWidth={1.5} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-cc-neutral-500 tracking-wide mb-1.5 flex items-center gap-2">
                  <Mail size={13} strokeWidth={1.5} /> 邮箱
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full bg-cc-neutral-50 border border-cc-border focus:border-cc-primary focus:ring-1 focus:ring-cc-primary/20 rounded-cc px-4 py-3 transition-all text-cc-neutral-800 placeholder:text-cc-neutral-400 outline-none"
                  placeholder="boss@coffee.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-cc-neutral-500 tracking-wide mb-1.5 flex items-center gap-2">
                  <Lock size={13} strokeWidth={1.5} /> 密码
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full bg-cc-neutral-50 border border-cc-border focus:border-cc-primary focus:ring-1 focus:ring-cc-primary/20 rounded-cc px-4 py-3 transition-all text-cc-neutral-800 placeholder:text-cc-neutral-400 outline-none"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <div className="text-cc-error text-sm font-medium bg-cc-error-bg rounded-cc px-4 py-2.5">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-cc-primary hover:bg-cc-primary-hover disabled:opacity-50 text-white font-medium py-3.5 rounded-cc transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} strokeWidth={2} /> : null}
                {submitting ? '登录中…' : '登录'}
              </button>
            </form>
          )}

          <p className="text-center text-cc-neutral-400 text-xs font-serif mt-10">
            登录即表示您已绑定门店，可发布黑卡专属活动
          </p>
        </div>
      </div>
    </div>
  )
}
