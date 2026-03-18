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
  return {
    name: bar?.name || '',
    category: bar?.category || '',
    address: bar?.address || '',
    contact_phone: bar?.contact_phone || '',
    cover_image_url: bar?.cover_image_url || '',
    description: bar?.description || ''
  }
}

export async function getLatestMerchantProfileRequest(barId) {
  if (!barId) return null
  const { data, error } = await memFire
    .from(REVIEW_TABLE)
    .select('id, bar_id, request_type, status, payload, review_comment, created_at, updated_at')
    .eq('bar_id', barId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(prettyMemfireError(error))
  return data?.[0] ?? null
}

export async function submitMerchantProfileRequest({
  barId,
  requestType = 'update',
  payload,
  submittedByEmail
}) {
  if (!barId) throw new Error('缺少门店 ID，无法提交审核')
  if (!payload || typeof payload !== 'object') throw new Error('提交内容为空')

  const { data: pendingRows, error: pendingError } = await memFire
    .from(REVIEW_TABLE)
    .select('id, status')
    .eq('bar_id', barId)
    .eq('status', 'pending')
    .limit(1)

  if (pendingError) throw new Error(prettyMemfireError(pendingError))
  if (pendingRows?.length) throw new Error('已有待审核记录，请等待管理员处理后再提交')

  const { data, error } = await memFire
    .from(REVIEW_TABLE)
    .insert([{
      bar_id: barId,
      request_type: requestType,
      status: 'pending',
      payload,
      submitted_by_email: submittedByEmail || null
    }])
    .select('id, bar_id, request_type, status, payload, review_comment, created_at, updated_at')
    .single()

  if (error) throw new Error(prettyMemfireError(error))
  return data
}
