import { memFire } from './memfire'

const REVIEW_TABLE = 'merchant_profile_change_requests'

function prettyMemfireError(error) {
  const msg = error?.message || ''
  if (msg.includes('relation') && msg.includes('does not exist')) {
    return '缺少审核单数据表 merchant_profile_change_requests，请先建表'
  }
  return msg || '请求失败'
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

  let pendingQuery = memFire
    .from(REVIEW_TABLE)
    .select('id, status')
    .eq('status', 'pending')
    .limit(1)

  if (barId) pendingQuery = pendingQuery.eq('bar_id', barId)
  else pendingQuery = pendingQuery.eq('partner_account_id', partnerAccountId)

  const { data: pendingRows, error: pendingError } = await pendingQuery

  if (pendingError) throw new Error(prettyMemfireError(pendingError))
  if (pendingRows?.length) throw new Error('已有待审核记录，请等待管理员处理后再提交')

  const { data, error } = await memFire
    .from(REVIEW_TABLE)
    .insert([{
      bar_id: barId || null,
      partner_account_id: partnerAccountId || null,
      request_type: requestType,
      status: 'pending',
      payload,
      submitted_by_email: submittedByEmail || null
    }])
    .select('id, bar_id, partner_account_id, request_type, status, payload, review_comment, created_at, updated_at')
    .single()

  if (error) throw new Error(prettyMemfireError(error))
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
}

export async function rejectMerchantProfileRequest({
  requestId,
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
}
