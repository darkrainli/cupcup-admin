import { memFire } from './memfire'

const ANNOUNCEMENTS_TABLE = 'app_announcements'
const USER_MESSAGES_TABLE = 'user_messages'
const PROFILES_TABLE = 'profiles'
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

async function fetchAllProfileIds() {
  const pageSize = 1000
  let from = 0
  let all = []

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await memFire
      .from(PROFILES_TABLE)
      .select('id')
      .range(from, to)

    if (error) throw error
    if (!data?.length) break

    all = all.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return all.map((row) => row.id).filter(Boolean)
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

  const profileIds = await fetchAllProfileIds()
  if (!profileIds.length) return { pushed: 0, announcement }

  const body = (announcement.summary || announcement.content || '').trim()
  const messageRows = profileIds.map((uid) => ({
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
