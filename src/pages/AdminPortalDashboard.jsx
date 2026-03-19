import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CheckCircle2, FileText, MapPin, Settings, Ticket, UserPlus } from 'lucide-react'
import { clearAdminSession, isAdminAuthenticated } from '../lib/adminSession'

const MODULES = [
  {
    key: 'bars',
    title: '录入店铺',
    desc: '新建/编辑店铺信息，维护地址、电话、经纬度与店铺图片。',
    to: '/admin/bars?from=dashboard',
    icon: MapPin,
    badgeClass: 'bg-cc-primary-subtle text-cc-primary'
  },
  {
    key: 'merchant-reviews',
    title: '商户审核',
    desc: '审核商户提交的门店资料变更申请，支持通过/驳回与日志追踪。',
    to: '/admin/merchant-reviews',
    icon: FileText,
    badgeClass: 'bg-cc-warning-bg text-cc-warning'
  },
  {
    key: 'audit-activities',
    title: '活动审核',
    desc: '审核商户活动并查看发卡名单、核销进度与活动时段配置。',
    to: '/admin/audit-activities',
    icon: Ticket,
    badgeClass: 'bg-violet-100 text-violet-700'
  },
  {
    key: 'partner-accounts',
    title: '商户账号开通',
    desc: '创建/重置 partner 登录账号，绑定门店，支持未绑定账号预开通。',
    to: '/admin/partner-accounts',
    icon: UserPlus,
    badgeClass: 'bg-cc-success-bg text-cc-success'
  },
  {
    key: 'app-config',
    title: 'App 配置',
    desc: '配置识别模型、每日打卡限制及其它全局运行参数。',
    to: '/admin/app-config',
    icon: Settings,
    badgeClass: 'bg-slate-100 text-slate-700'
  }
]

export default function AdminPortalDashboard() {
  const navigate = useNavigate()
  const isAuthenticated = isAdminAuthenticated()
  if (!isAuthenticated) return <Navigate to="/admin/bars" replace />

  return (
    <div className="min-h-screen bg-cc-neutral-50">
      <nav className="bg-cc-surface/80 backdrop-blur-sm border-b border-cc-border px-6 py-4 sticky top-0 z-40 flex items-center justify-between shadow-cc-sm">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="CupCup" className="w-8 h-8 rounded-cc shrink-0" />
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-cc-neutral-800 tracking-tight">CupCup 管理系统</h1>
            <p className="text-xs font-medium text-cc-neutral-500">Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-cc-success bg-cc-success-bg px-3 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 size={12} /> 模块总览
          </span>
          <button
            type="button"
            onClick={() => {
              clearAdminSession()
              navigate('/admin/bars', { replace: true })
            }}
            className="text-xs font-bold text-cc-neutral-500 hover:text-cc-error transition-colors flex items-center gap-1 bg-cc-neutral-100 px-3 py-1 rounded-full"
          >
            退出登录
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {MODULES.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                to={item.to}
                className="bg-cc-surface rounded-cc-xl border border-cc-border p-5 shadow-sm hover:shadow-md hover:border-cc-primary transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.badgeClass}`}>
                  <Icon size={18} />
                </div>
                <h2 className="mt-4 text-base font-bold text-cc-neutral-800">{item.title}</h2>
                <p className="mt-2 text-sm text-cc-neutral-500 leading-relaxed">{item.desc}</p>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
