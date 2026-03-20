import { memFire } from './memfire'

const ANNOUNCEMENTS_TABLE = 'app_announcements'
const USER_MESSAGES_TABLE = 'user_messages'
const PROFILES_TABLE = 'profiles'
const COLLECTED_CARDS_TABLE = 'collected_cards'
const USER_SSR_CARDS_TABLE = 'user_ssr_cards'
const COVER_BUCKET = 'cup-images'

export async function fetchAnnouncements() {
  const { data, error } = await memFire
    .from(ANNOUNCEMENTS_TABLE)
    .select('id,title,summary,content,cover_image_url,status,published_at,created_at,updated_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function uploadAnnouncementCover(file) {
  const ext = (file?.name?.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const path = `official-banners/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${safeExt}`
  const { error } = await memFire.storage.from(COVER_BUCKET).upload(path, file)
  if (error) throw error
  const { data } = memFire.storage.from(COVER_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function upsertAnnouncement(payload) {
  const clean = {
    title: payload.title?.trim() || '',
    summary: payload.summary?.trim() || '',
    content: payload.content?.trim() || '',
    cover_image_url: payload.cover_image_url?.trim() || null,
    status: payload.status || 'draft'
  }

  if (!clean.title) throw new Error('标题不能为空')
  if (!clean.content) throw new Error('正文不能为空')

  if (payload.id) {
    const { data, error } = await memFire
      .from(ANNOUNCEMENTS_TABLE)
      .update(clean)
      .eq('id', payload.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await memFire
    .from(ANNOUNCEMENTS_TABLE)
    .insert(clean)
    .select('*')
    .single()

  if (error) throw error
  return data
}

async function fetchAllValuesFromTable(table, field) {
  const pageSize = 1000
  let from = 0
  const values = []

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await memFire
      .from(table)
      .select(field)
      .range(from, to)

    if (error) throw error
    if (!data?.length) break

    for (const row of data) {
      const v = row?.[field]
      if (v) values.push(v)
    }
    if (data.length < pageSize) break
    from += pageSize
  }

  return values
}

async function fetchProfileAudienceUserIds() {
  const pageSize = 1000
  let from = 0
  const values = []

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await memFire
      .from(PROFILES_TABLE)
      .select('id,cup_id')
      .range(from, to)

    if (error) throw error
    if (!data?.length) break

    for (const row of data) {
      if (row?.id) values.push(row.id)
      if (row?.cup_id) values.push(row.cup_id)
    }
    if (data.length < pageSize) break
    from += pageSize
  }

  return values
}

async function fetchAllAudienceUserIds() {
  const [profileIds, cardUserIds, ssrUserIds, messageUserIds] = await Promise.all([
    fetchProfileAudienceUserIds(),
    fetchAllValuesFromTable(COLLECTED_CARDS_TABLE, 'user_id'),
    fetchAllValuesFromTable(USER_SSR_CARDS_TABLE, 'user_id'),
    fetchAllValuesFromTable(USER_MESSAGES_TABLE, 'user_id')
  ])
  return [...new Set([...profileIds, ...cardUserIds, ...ssrUserIds, ...messageUserIds])]
}

async function insertUserMessagesInBatches(rows) {
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await memFire.from(USER_MESSAGES_TABLE).insert(chunk)
    if (error) throw error
  }
}

export async function publishAnnouncementAndPushMessages(announcementInput) {
  let announcement = announcementInput

  if (announcement.status === 'published') {
    return { pushed: 0, announcement }
  }

  if (announcement.status !== 'published') {
    const { data, error } = await memFire
      .from(ANNOUNCEMENTS_TABLE)
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', announcement.id)
      .select('*')
      .single()

    if (error) throw error
    announcement = data
  }

  const audienceUserIds = await fetchAllAudienceUserIds()
  if (!audienceUserIds.length) return { pushed: 0, announcement }

  const body = (announcement.summary || announcement.content || '').trim()
  const messageRows = audienceUserIds.map((uid) => ({
    user_id: uid,
    type: 'system',
    event: 'system_announcement',
    title: announcement.title,
    body,
    cta_text: '查看详情',
    cta_route: '/messages/announcement',
    cta_action: 'open_announcement',
    cta_payload: { announcementId: announcement.id },
    announcement_id: announcement.id,
    is_read: false
  }))

  await insertUserMessagesInBatches(messageRows)
  return { pushed: messageRows.length, announcement }
}

export async function deleteAnnouncementById(announcementId) {
  if (!announcementId) throw new Error('公告 ID 无效')

  const { error: msgError } = await memFire
    .from(USER_MESSAGES_TABLE)
    .delete()
    .eq('announcement_id', announcementId)
  if (msgError) throw msgError

  const { error: annError } = await memFire
    .from(ANNOUNCEMENTS_TABLE)
    .delete()
    .eq('id', announcementId)
  if (annError) throw annError
}
