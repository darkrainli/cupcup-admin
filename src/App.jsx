/**
 * CupCup 后台入口：路由分发
 * - partner.cupcup.club 根路径 → 自动跳转 /partner/login（商户入口）
 * - /partner/login、/partner/create-activity → 商户端（邮箱登录 + 活动发布）
 * - 其余路径 → 管理员后台（门店录入/编辑）
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PartnerAuthProvider } from './context/PartnerAuthContext'
import { isAdminAuthenticated } from './lib/adminSession'
import PartnerLogin from './pages/PartnerLogin'
import PartnerDashboard from './pages/PartnerDashboard'
import PartnerCreateActivity from './pages/PartnerCreateActivity'
import PartnerMerchantProfile from './pages/PartnerMerchantProfile'
import AdminDashboard from './pages/AdminDashboard'
import AdminPortalDashboard from './pages/AdminPortalDashboard'
import AuditActivities from './pages/AuditActivities'
import AppConfig from './pages/AppConfig'
import MerchantProfileReviews from './pages/MerchantProfileReviews'
import AdminPartnerAccounts from './pages/AdminPartnerAccounts'
import AdminLoginAuditLogs from './pages/AdminLoginAuditLogs'
import AdminAccounts from './pages/AdminAccounts'
import PartnerLoginAuditLogs from './pages/PartnerLoginAuditLogs'

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

function App() {
  return (
    <PartnerAuthProvider>
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
          <Route path="/" element={<RootRedirect />} />
          <Route path="/*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </PartnerAuthProvider>
  )
}

export default App
