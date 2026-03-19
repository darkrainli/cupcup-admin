/**
 * 商户仪表盘：展示当前门店信息、到店转化、本店打卡人数等概览模块，
 * 「新建黑卡专属活动」作为一个 App 卡片入口，点击进入活动发布页。
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Wine, MapPin, Phone, PieChart, Hash, Loader2, UserCheck, Ticket } from 'lucide-react'
import { usePartnerAuth } from '../context/PartnerAuthContext'
import { memFire } from '../context/PartnerAuthContext'
import {
  buildPayloadFromBar,
  getLatestMerchantProfileRequest,
  submitMerchantProfileRequest
} from '../lib/merchantProfileReviewService'

// 到店转化饼图，与 PartnerCreateActivity 中保持视觉一致
function PieChartSvg({ totalSlots, actualVisit }) {
  const r = 40
  const cx = 50
  const cy = 50
  const ratio = totalSlots > 0 ? Math.min(1, actualVisit / totalSlots) : 0
  const angle1 = ratio * 360
  const toRad = (deg) => (deg - 90) * (Math.PI / 180)
  const point = (deg) => ({ x: cx + r * Math.cos(toRad(deg)), y: cy + r * Math.sin(toRad(deg)) })
  const large = (a, b) => (b - a > 180 ? 1 : 0)
  const path1 = angle1 > 0
    ? `M ${cx} ${cy} L ${point(0).x} ${point(0).y} A ${r} ${r} 0 ${large(0, angle1)} 1 ${point(angle1).x} ${point(angle1).y} Z`
    : ''
  const path2 = angle1 < 360
    ? `M ${cx} ${cy} L ${point(angle1).x} ${point(angle1).y} A ${r} ${r} 0 ${large(angle1, 360)} 1 ${point(360).x} ${point(360).y} Z`
    : ''
  return (
    <svg width={100} height={100} viewBox="0 0 100 100" className="shrink-0">
      <path d={path1} fill="#6366f1" stroke="#fff" strokeWidth={2} />
      <path d={path2} fill="#e2e8f0" stroke="#fff" strokeWidth={2} />
    </svg>
  )
}

export default function PartnerDashboard() {
  const navigate = useNavigate()
  const { barId, barInfo, partnerAccount, loading: authLoading, refreshBarInfo, refreshPartnerSession, isPartnerLoggedIn, logout } = usePartnerAuth()

  const [barDisplay, setBarDisplay] = useState(null)
  const [activitiesList, setActivitiesList] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [checkInCount, setCheckInCount] = useState(null)
  const [checkInCountLoading, setCheckInCountLoading] = useState(false)
  const [latestProfileReview, setLatestProfileReview] = useState(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')

  // 未登录商户则跳转登录
  if (!authLoading && !isPartnerLoggedIn) {
    return <Navigate to="/partner/login" replace />
  }

  // 初始化门店信息
  useEffect(() => {
    if (!barId || !barInfo) return
    setBarDisplay(barInfo)
  }, [barId, barInfo])

  useEffect(() => {
    if (barId) refreshBarInfo()
    else if (partnerAccount?.id) refreshPartnerSession()
  }, [barId, partnerAccount?.id, refreshBarInfo, refreshPartnerSession])

  const fetchActivitiesList = useCallback(async () => {
    if (!barId) return
    setActivitiesLoading(true)
    const { data, error } = await memFire
      .from('bar_events')
      .select('id, title, cover_image_url, status, created_at, reject_reason, max_participants, actual_verified_count')
      .eq('bar_id', barId)
      .order('created_at', { ascending: false })
    setActivitiesLoading(false)
    if (!error && data) setActivitiesList(data)
    else setActivitiesList([])
  }, [barId])

  useEffect(() => {
    if (barId) fetchActivitiesList()
  }, [barId, fetchActivitiesList])

  const fetchCheckInCount = useCallback(async () => {
    if (!barId || !barInfo?.name) return
    setCheckInCountLoading(true)
    const { data, error } = await memFire.rpc('get_bar_checkin_count', { p_bar_name: barInfo.name })
    setCheckInCountLoading(false)
    if (!error && typeof data === 'number') setCheckInCount(data)
    else if (!error && data != null) setCheckInCount(Number(data) || 0)
    else setCheckInCount(0)
  }, [barId, barInfo?.name])

  useEffect(() => {
    if (barId && barInfo?.name) fetchCheckInCount()
  }, [barId, barInfo?.name, fetchCheckInCount])

  const fetchLatestProfileReview = useCallback(async () => {
    if (!barId) return
    setReviewLoading(true)
    setReviewError('')
    try {
      const row = await getLatestMerchantProfileRequest(barId)
      setLatestProfileReview(row)
    } catch (err) {
      setReviewError(err?.message || '读取审核状态失败')
    } finally {
      setReviewLoading(false)
    }
  }, [barId])

  useEffect(() => {
    if (barId) fetchLatestProfileReview()
  }, [barId, fetchLatestProfileReview])

  const handleSubmitProfileReview = useCallback(async () => {
    if (!barId || !barDisplay) return
    setReviewSubmitting(true)
    setReviewError('')
    try {
      const payload = buildPayloadFromBar(barDisplay)
      const next = await submitMerchantProfileRequest({
        barId,
        requestType: 'update',
        payload,
        submittedByEmail: partnerAccount?.email || ''
      })
      setLatestProfileReview(next)
    } catch (err) {
      setReviewError(err?.message || '提交失败')
    } finally {
      setReviewSubmitting(false)
    }
  }, [barId, barDisplay])

  // 审核通过活动的总名额与实际到店人数
  const pieStats = (() => {
    const approved = activitiesList.filter((a) => a.status === 'approved')
    const totalSlots = approved.reduce((s, a) => s + (Number(a.max_participants) || 0), 0)
    const actualVisit = approved.reduce((s, a) => s + (Number(a.actual_verified_count) || 0), 0)
    return { totalSlots, actualVisit }
  })()

  const recentActivities = activitiesList.slice(0, 5)

  return (
    <div className="min-h-screen bg-cc-neutral-50">
      {/* 顶部导航 */}
      <nav className="bg-cc-surface/80 backdrop-blur-sm border-b border-cc-border px-6 py-4 sticky top-0 z-50 flex items-center justify-between shadow-cc-sm">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="CupCup" className="w-8 h-8 rounded-cc shrink-0" />
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-cc-neutral-800 tracking-tight">CupWorld Partner</h1>
            <p className="text-xs font-medium text-cc-neutral-500 font-serif">商户仪表盘</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/partner/merchant-profile')}
            className="hidden sm:flex items-center gap-2 bg-cc-neutral-100 hover:bg-cc-neutral-200 text-cc-neutral-700 text-xs font-bold px-4 py-2 rounded-full"
          >
            门店信息编辑
          </button>
          <button
            type="button"
            onClick={() => navigate('/partner/create-activity')}
            className="hidden sm:flex items-center gap-2 bg-cc-primary hover:bg-cc-primary-hover text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm"
          >
            <Hash size={14} /> 黑卡专属活动
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout()
              window.location.href = '/partner/login'
            }}
            className="text-xs font-bold text-cc-neutral-500 hover:text-cc-error transition-colors flex items-center gap-1 bg-cc-neutral-100 px-3 py-1 rounded-full"
          >
            退出登录
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* 上半部分：当前门店 + 到店转化 + 本店打卡人数 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="bg-cc-surface rounded-cc-xl shadow-sm border border-cc-border p-6 flex flex-col gap-4 lg:col-span-2">
            <h2 className="text-sm font-bold text-cc-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <Wine size={14} /> 当前门店
            </h2>
            {barDisplay ? (
              <div className="flex flex-col sm:flex-row gap-4">
                {barDisplay.cover_image_url ? (
                  <img
                    src={barDisplay.cover_image_url}
                    alt=""
                    className="w-20 h-20 rounded-cc object-cover border border-cc-border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-cc bg-cc-neutral-100 flex items-center justify-center text-cc-neutral-500">
                    <Wine size={28} />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-bold text-cc-neutral-800 truncate">{barDisplay.name || '未命名门店'}</p>
                  {!!barDisplay.address && (
                    <p className="text-xs text-cc-neutral-500 flex items-center gap-1">
                      <MapPin size={14} /> {barDisplay.address}
                    </p>
                  )}
                  {!!barDisplay.contact_phone && (
                    <p className="text-xs text-cc-neutral-500 flex items-center gap-1">
                      <Phone size={14} /> {barDisplay.contact_phone}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center text-cc-neutral-500 text-sm">
                {authLoading ? '加载门店信息中…' : '账号已开通但尚未绑定门店，请先进入门店信息编辑提交审核'}
              </div>
            )}
          </div>

          {/* 本店打卡人数：放在第二格，紧跟当前门店，确保可见 */}
          <div className="bg-cc-surface rounded-cc-xl shadow-sm border-2 border-cc-success/30 p-6 flex flex-col justify-center gap-1">
            <h2 className="text-sm font-bold text-cc-neutral-500 uppercase tracking-wider flex items-center gap-2">
              <UserCheck size={15} className="text-cc-success" /> 本店打卡人数
            </h2>
            {checkInCountLoading ? (
              <span className="flex items-center gap-1 text-cc-neutral-500">
                <Loader2 size={18} className="animate-spin" /> 加载中…
              </span>
            ) : (
              <>
                <p className="text-2xl font-bold text-cc-neutral-800">
                  {checkInCount != null ? checkInCount : '--'}
                </p>
                <p className="text-xs text-cc-neutral-500">
                  在本店 NFC 打卡的用户数
                </p>
              </>
            )}
          </div>

          <div className="bg-cc-surface rounded-cc-xl shadow-sm border border-cc-border p-6 flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <h2 className="text-sm font-bold text-cc-neutral-500 uppercase tracking-wider flex items-center gap-2">
                <PieChart size={15} className="text-cc-primary" /> 到店转化
              </h2>
              <p className="text-2xl font-black text-cc-neutral-800">
                {pieStats.totalSlots > 0
                  ? `${Math.round((pieStats.actualVisit / pieStats.totalSlots) * 100)}%`
                  : '--'}
              </p>
              <p className="text-xs text-cc-neutral-500">
                已核销 {pieStats.actualVisit} / 发出名额 {pieStats.totalSlots}
              </p>
            </div>
            <PieChartSvg totalSlots={pieStats.totalSlots} actualVisit={pieStats.actualVisit} />
          </div>
        </div>

        {/* 中间：小应用区 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            type="button"
            onClick={() => navigate('/partner/merchant-profile')}
            className="bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-5 flex flex-col items-start gap-3 hover:border-cc-primary hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-cc-neutral-900 flex items-center justify-center text-white">
              <MapPin size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-black text-cc-neutral-800">门店信息编辑</h3>
              <p className="text-xs text-cc-neutral-500 mt-1">
                修改店铺名称、地址、电话与图片并提交审核。经纬度由平台审核时补全。
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/partner/create-activity')}
            className="bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-5 flex flex-col items-start gap-3 hover:border-cc-primary hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white">
              <Ticket size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-black text-cc-neutral-800">黑卡专属活动</h3>
              <p className="text-xs text-cc-neutral-500 mt-1">
                新建并管理黑卡专属线下活动，系统会自动为符合条件的黑卡用户发放 CupSSR 邀请卡。
              </p>
            </div>
          </button>

          <div className="bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-5 flex flex-col gap-2 md:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-cc-neutral-600 uppercase tracking-wider flex items-center gap-2">
                <PieChart size={14} /> 最近活动概览
              </h3>
              {activitiesLoading && (
                <span className="flex items-center gap-1 text-xs text-cc-neutral-500">
                  <Loader2 size={12} className="animate-spin" /> 刷新中…
                </span>
              )}
            </div>
            {recentActivities.length === 0 ? (
              <p className="text-xs text-cc-neutral-500">
                还没有创建过黑卡专属活动，点击左侧「黑卡专属活动」开始创建你的第一场活动吧。
              </p>
            ) : (
              <div className="space-y-2">
                {recentActivities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 text-xs text-cc-neutral-600 bg-cc-neutral-100/80 rounded-xl px-3 py-2"
                  >
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        a.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-600'
                          : a.status === 'rejected'
                          ? 'bg-red-50 text-red-500'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {a.status === 'approved'
                        ? '已发布'
                        : a.status === 'rejected'
                        ? '已驳回'
                        : '待审核'}
                    </span>
                    <span className="truncate flex-1">{a.title || '未命名活动'}</span>
                    <span className="text-cc-neutral-500">
                      {Number(a.actual_verified_count) || 0} / {Number(a.max_participants) || 0} 人到店
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-cc-surface rounded-cc-xl border border-cc-border shadow-sm p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-cc-neutral-700 uppercase tracking-wider">门店信息审核（试运行）</h3>
              <p className="text-xs text-cc-neutral-500 mt-1">
                本步骤用于验证“商户提交资料 → 管理端审核”的数据链路，当前先提交当前门店信息快照。
              </p>
            </div>
            <button
              type="button"
              disabled={!barDisplay || reviewSubmitting}
              onClick={handleSubmitProfileReview}
              className="bg-cc-primary hover:bg-cc-primary-hover disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-full"
            >
              {reviewSubmitting ? '提交中…' : '提交门店信息审核'}
            </button>
          </div>

          {reviewLoading ? (
            <p className="text-xs text-cc-neutral-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> 读取审核状态中…</p>
          ) : latestProfileReview ? (
            <div className="text-xs rounded-xl bg-cc-neutral-100/80 px-3 py-2 text-cc-neutral-600">
              最新审核状态：
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                latestProfileReview.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-600'
                  : latestProfileReview.status === 'rejected'
                    ? 'bg-red-50 text-red-500'
                    : 'bg-amber-50 text-amber-600'
              }`}>
                {latestProfileReview.status === 'approved'
                  ? '已通过'
                  : latestProfileReview.status === 'rejected'
                    ? '已驳回'
                    : '待审核'}
              </span>
              <span className="ml-2 text-cc-neutral-500">
                提交时间：{latestProfileReview.created_at ? new Date(latestProfileReview.created_at).toLocaleString() : '--'}
              </span>
              {latestProfileReview.review_comment ? (
                <p className="mt-2 text-red-500">驳回原因：{latestProfileReview.review_comment}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-cc-neutral-500">暂无审核记录</p>
          )}

          {reviewError ? (
            <p className="text-xs text-red-500">{reviewError}</p>
          ) : null}
        </section>
      </main>
    </div>
  )
}
