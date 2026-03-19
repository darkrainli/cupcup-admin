import { memFire } from './memfire'

const REVIEW_TABLE = 'merchant_profile_change_requests'
const REVIEW_LOG_TABLE = 'merchant_profile_review_logs'

function prettyMemfireError(error) {
  const msg = error?.message || ''
  if (msg.includes('relation') && msg.includes('does not exist')) {
    return '缺少审核单数据表 merchant_profile_change_requests，请先建表'
  }
  return msg || '请求失败'
}

async function appendReviewLog({
  requestId,
  action,
  operatorRole,
  operatorId,
  operatorEmail,
  beforeStatus,
  afterStatus,
  comment,
  requestType,
  barId,
  partnerAccountId
}) {
  try {
    await memFire.from(REVIEW_LOG_TABLE).insert([{
      request_id: requestId,
      action,
      operator_role: operatorRole || 'system',
      operator_id: operatorId || null,
      operator_email: operatorEmail || null,
      before_status: beforeStatus || null,
      after_status: afterStatus || null,
      comment: comment || null,
      request_type: requestType || null,
      bar_id: barId || null,
      partner_account_id: partnerAccountId || null
    }])
  } catch (error) {
    console.warn('[merchant-profile-review-log] insert failed:', error?.message || error)
  }
}

export function buildPayloadFromBar(bar) {
  const detailImages = Array.isArray(bar?.detail_images)
    ? bar.detail_images.slice(0, 5)
    : (bar?.cover_image_url ? [bar.cover_image_url] : [])

  return {
    name: bar?.name || '',
    category: bar?.category || '',
    address: bar?.address || '',
    contact_phone: bar?.contact_phone || '',
    cover_image_url: bar?.cover_image_url || '',
    detail_images: detailImages,
    description: bar?.description || ''
  }
}

export async function getLatestMerchantProfileRequest(barId) {
  if (!barId) return null
  const { data, error } = await memFire
    .from(REVIEW_TABLE)
    .select('id, bar_id, partner_account_id, request_type, status, payload, review_comment, created_at, updated_at')
    .eq('bar_id', barId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(prettyMemfireError(error))
  return data?.[0] ?? null
}

export async function getLatestMerchantProfileRequestByPartnerAccount(partnerAccountId) {
  if (!partnerAccountId) return null
  const { data, error } = await memFire
    .from(REVIEW_TABLE)
    .select('id, bar_id, partner_account_id, request_type, status, payload, review_comment, created_at, updated_at')
    .eq('partner_account_id', partnerAccountId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(prettyMemfireError(error))
  return data?.[0] ?? null
}

export async function submitMerchantProfileRequest({
  barId,
  partnerAccountId,
  requestType = 'update',
  payload,
  submittedByEmail
}) {
  if (!barId && !partnerAccountId) throw new Error('缺少门店或账号标识，无法提交审核')
  if (!payload || typeof payload !== 'object') throw new Error('提交内容为空')

  let effectiveBarId = barId || null
  let effectiveRequestType = requestType

  // 防御：如果 bar_id 已失效（门店被删除），自动降级为创建申请，避免外键报错
  if (effectiveBarId) {
    const { data: linkedBar, error: linkedBarError } = await memFire
      .from('bars')
      .select('id')
      .eq('id', effectiveBarId)
      .maybeSingle()

    if (linkedBarError) throw new Error(linkedBarError?.message || '校验门店失败')
    if (!linkedBar?.id) {
      effectiveBarId = null
      effectiveRequestType = 'create'
    }
  }

  let pendingQuery = memFire
    .from(REVIEW_TABLE)
    .select('id, status')
    .eq('status', 'pending')
    .limit(1)

  if (effectiveBarId) pendingQuery = pendingQuery.eq('bar_id', effectiveBarId)
  else pendingQuery = pendingQuery.eq('partner_account_id', partnerAccountId)

  const { data: pendingRows, error: pendingError } = await pendingQuery

  if (pendingError) throw new Error(prettyMemfireError(pendingError))
  if (pendingRows?.length) throw new Error('已有待审核记录，请等待管理员处理后再提交')

  const { data, error } = await memFire
    .from(REVIEW_TABLE)
    .insert([{
      bar_id: effectiveBarId,
      partner_account_id: partnerAccountId || null,
      request_type: effectiveRequestType,
      status: 'pending',
      payload,
      submitted_by_email: submittedByEmail || null
    }])
    .select('id, bar_id, partner_account_id, request_type, status, payload, review_comment, created_at, updated_at')
    .single()

  if (error) throw new Error(prettyMemfireError(error))

  await appendReviewLog({
    requestId: data.id,
    action: 'submit',
    operatorRole: 'partner',
    operatorEmail: submittedByEmail || null,
    beforeStatus: null,
    afterStatus: data.status,
    requestType: data.request_type,
    barId: data.bar_id,
    partnerAccountId: data.partner_account_id
  })

  return data
}

export async function listMerchantProfileRequests(status = '') {
  let query = memFire
    .from(REVIEW_TABLE)
    .select('id, bar_id, partner_account_id, request_type, status, payload, review_comment, submitted_by_email, reviewed_by, reviewed_at, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw new Error(prettyMemfireError(error))
  return data || []
}

export async function listMerchantProfileRequestLogs(requestId) {
  if (!requestId) return []
  const { data, error } = await memFire
    .from(REVIEW_LOG_TABLE)
    .select('id, request_id, action, operator_role, operator_id, operator_email, before_status, after_status, comment, request_type, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(prettyMemfireError(error))
  return data || []
}

export async function getBarById(barId) {
  if (!barId) return null
  const { data, error } = await memFire
    .from('bars')
    .select('*')
    .eq('id', barId)
    .single()
  if (error) throw new Error(error?.message || '读取门店失败')
  return data
}

export async function approveMerchantProfileRequest({
  request,
  appliedBarData,
  reviewer = 'admin'
}) {
  if (!request?.id) throw new Error('审核单数据不完整')
  const latRaw = String(appliedBarData?.latitude ?? '').trim()
  const lonRaw = String(appliedBarData?.longitude ?? '').trim()
  if (!latRaw || !lonRaw) throw new Error('经纬度为空，不能通过审核')

  const latitude = Number(latRaw)
  const longitude = Number(lonRaw)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('北纬范围无效')
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('东经范围无效')

  const baseBarPayload = {
    name: appliedBarData?.name || '',
    category: appliedBarData?.category || '',
    address: appliedBarData?.address || '',
    contact_phone: appliedBarData?.contact_phone || '',
    cover_image_url: appliedBarData?.cover_image_url || '',
    detail_images: Array.isArray(appliedBarData?.detail_images)
      ? appliedBarData.detail_images.slice(0, 5)
      : (appliedBarData?.cover_image_url ? [appliedBarData.cover_image_url] : []),
    description: appliedBarData?.description || '',
    latitude,
    longitude
  }

  if (!baseBarPayload.cover_image_url && baseBarPayload.detail_images.length > 0) {
    baseBarPayload.cover_image_url = baseBarPayload.detail_images[0]
  }

  let targetBarId = request.bar_id || null

  if (targetBarId) {
    const { error: barError } = await memFire
      .from('bars')
      .update(baseBarPayload)
      .eq('id', targetBarId)
    if (barError) throw new Error(barError?.message || '写入门店失败')
  } else {
    const insertPayload = {
      ...baseBarPayload,
      image_name: baseBarPayload.cover_image_url || ''
    }
    const { data: insertedBar, error: insertError } = await memFire
      .from('bars')
      .insert([insertPayload])
      .select('id')
      .single()
    if (insertError) throw new Error(insertError?.message || '创建门店失败')
    targetBarId = insertedBar?.id || null
    if (!targetBarId) throw new Error('创建门店失败：未返回门店 ID')

    if (request.partner_account_id) {
      const { error: bindError } = await memFire
        .from('partner_accounts')
        .update({ bar_id: targetBarId })
        .eq('id', request.partner_account_id)
      if (bindError) throw new Error(bindError?.message || '绑定商户账号失败')
    }
  }

  const { error: reqError } = await memFire
    .from(REVIEW_TABLE)
    .update({
      bar_id: targetBarId,
      status: 'approved',
      review_comment: null,
      reviewed_by: reviewer,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', request.id)

  if (reqError) throw new Error(prettyMemfireError(reqError))

  await appendReviewLog({
    requestId: request.id,
    action: 'approve',
    operatorRole: 'admin',
    operatorId: reviewer || 'admin',
    beforeStatus: request.status || 'pending',
    afterStatus: 'approved',
    requestType: request.request_type,
    barId: targetBarId || request.bar_id,
    partnerAccountId: request.partner_account_id
  })
}

export async function rejectMerchantProfileRequest({
  requestId,
  request,
  reason,
  reviewer = 'admin'
}) {
  const trimmed = (reason || '').trim()
  if (!trimmed) throw new Error('驳回原因不能为空')

  const { error } = await memFire
    .from(REVIEW_TABLE)
    .update({
      status: 'rejected',
      review_comment: trimmed,
      reviewed_by: reviewer,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', requestId)

  if (error) throw new Error(prettyMemfireError(error))

  await appendReviewLog({
    requestId,
    action: 'reject',
    operatorRole: 'admin',
    operatorId: reviewer || 'admin',
    beforeStatus: request?.status || 'pending',
    afterStatus: 'rejected',
    comment: trimmed,
    requestType: request?.request_type,
    barId: request?.bar_id,
    partnerAccountId: request?.partner_account_id
  })
}
