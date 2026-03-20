/**
 * CupCup 后台入口：路由分发
 * - partner.cupcup.club 根路径 → 自动跳转 /partner/login（商户入口）
 * - /partner/login、/partner/create-activity → 商户端（邮箱登录 + 活动发布）
 * - 其余路径 → 管理员后台（门店录入/编辑）
 */
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PartnerAuthProvider } from './context/PartnerAuthContext'
import { isAdminAuthenticated } from './lib/adminSession'

const PartnerLogin = lazy(() => import('./pages/PartnerLogin'))
const PartnerDashboard = lazy(() => import('./pages/PartnerDashboard'))
const PartnerCreateActivity = lazy(() => import('./pages/PartnerCreateActivity'))
const PartnerMerchantProfile = lazy(() => import('./pages/PartnerMerchantProfile'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminPortalDashboard = lazy(() => import('./pages/AdminPortalDashboard'))
const AuditActivities = lazy(() => import('./pages/AuditActivities'))
const AppConfig = lazy(() => import('./pages/AppConfig'))
const MerchantProfileReviews = lazy(() => import('./pages/MerchantProfileReviews'))
const AdminPartnerAccounts = lazy(() => import('./pages/AdminPartnerAccounts'))
const AdminLoginAuditLogs = lazy(() => import('./pages/AdminLoginAuditLogs'))
const AdminAccounts = lazy(() => import('./pages/AdminAccounts'))
const PartnerLoginAuditLogs = lazy(() => import('./pages/PartnerLoginAuditLogs'))
const AppOfficialMessages = lazy(() => import('./pages/AppOfficialMessages'))

const PARTNER_DOMAIN = 'partner.cupcup.club'

function AdminGuard({ children }) {
  if (!isAdminAuthenticated()) return <Navigate to="/admin/bars" replace />
  return children
}

function RootRedirect() {
  const isPartnerDomain = typeof window !== 'undefined' && window.location.hostname === PARTNER_DOMAIN
  if (isPartnerDomain) return <Navigate to="/partner/login" replace />
  return <Navigate to="/admin/dashboard" replace />
}

function RouteLoading() {
  return (
    <div className="min-h-screen bg-cc-neutral-50 flex items-center justify-center">
      <div className="text-sm font-semibold text-cc-neutral-500">页面加载中…</div>
    </div>
  )
}

function App() {
  return (
    <PartnerAuthProvider>
      <Suspense fallback={<RouteLoading />}>
        <BrowserRouter>
          <Routes>
            <Route path="/partner/login" element={<PartnerLogin />} />
            <Route path="/partner/dashboard" element={<PartnerDashboard />} />
            <Route path="/partner/create-activity" element={<PartnerCreateActivity />} />
            <Route path="/partner/merchant-profile" element={<PartnerMerchantProfile />} />
            <Route path="/admin/dashboard" element={<AdminGuard><AdminPortalDashboard /></AdminGuard>} />
            <Route path="/admin/bars" element={<AdminDashboard />} />
            <Route path="/admin/audit-activities" element={<AdminGuard><AuditActivities /></AdminGuard>} />
            <Route path="/admin/merchant-reviews" element={<AdminGuard><MerchantProfileReviews /></AdminGuard>} />
            <Route path="/admin/partner-accounts" element={<AdminGuard><AdminPartnerAccounts /></AdminGuard>} />
            <Route path="/admin/admin-accounts" element={<AdminGuard><AdminAccounts /></AdminGuard>} />
            <Route path="/admin/login-audit" element={<AdminGuard><AdminLoginAuditLogs /></AdminGuard>} />
            <Route path="/admin/partner-login-audit" element={<AdminGuard><PartnerLoginAuditLogs /></AdminGuard>} />
            <Route path="/admin/app-config" element={<AdminGuard><AppConfig /></AdminGuard>} />
            <Route path="/admin/app-official-messages" element={<AdminGuard><AppOfficialMessages /></AdminGuard>} />
            <Route path="/" element={<RootRedirect />} />
            <Route path="/*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </Suspense>
    </PartnerAuthProvider>
  )
}

export default App
