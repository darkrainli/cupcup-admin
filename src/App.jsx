/**
 * CupCup 后台入口：路由分发
 * - /partner/login、/partner/create-activity → 商户端（邮箱登录 + 活动发布）
 * - 其余路径 → 管理员后台（门店录入/编辑）
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PartnerAuthProvider } from './context/PartnerAuthContext'
import PartnerLogin from './pages/PartnerLogin'
import PartnerCreateActivity from './pages/PartnerCreateActivity'
import AdminDashboard from './pages/AdminDashboard'
import AuditActivities from './pages/AuditActivities'

function App() {
  return (
    <PartnerAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/partner/login" element={<PartnerLogin />} />
          <Route path="/partner/create-activity" element={<PartnerCreateActivity />} />
          <Route path="/admin/audit-activities" element={<AuditActivities />} />
          <Route path="/*" element={<AdminDashboard />} />
        </Routes>
      </BrowserRouter>
    </PartnerAuthProvider>
  )
}

export default App
