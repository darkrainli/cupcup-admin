/**
 * CupCup 后台入口：路由分发
 * - partner.cupcup.club 根路径 → 自动跳转 /partner/login（商户入口）
 * - /partner/login、/partner/create-activity → 商户端（邮箱登录 + 活动发布）
 * - 其余路径 → 管理员后台（门店录入/编辑）
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PartnerAuthProvider } from './context/PartnerAuthContext'
import PartnerLogin from './pages/PartnerLogin'
import PartnerDashboard from './pages/PartnerDashboard'
import PartnerCreateActivity from './pages/PartnerCreateActivity'
import AdminDashboard from './pages/AdminDashboard'
import AuditActivities from './pages/AuditActivities'
import AppConfig from './pages/AppConfig'

const PARTNER_DOMAIN = 'partner.cupcup.club'

function RootRedirect() {
  const isPartnerDomain = typeof window !== 'undefined' && window.location.hostname === PARTNER_DOMAIN
  if (isPartnerDomain) return <Navigate to="/partner/login" replace />
  return <AdminDashboard />
}

function App() {
  return (
    <PartnerAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/partner/login" element={<PartnerLogin />} />
          <Route path="/partner/dashboard" element={<PartnerDashboard />} />
          <Route path="/partner/create-activity" element={<PartnerCreateActivity />} />
          <Route path="/admin/audit-activities" element={<AuditActivities />} />
          <Route path="/admin/app-config" element={<AppConfig />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/*" element={<AdminDashboard />} />
        </Routes>
      </BrowserRouter>
    </PartnerAuthProvider>
  )
}

export default App
