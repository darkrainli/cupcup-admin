/**
 * MemFire 客户端单例，全站唯一，避免 Multiple GoTrueClient 警告
 */
import { createClient } from '@supabase/supabase-js'

const MEMFIRE_URL = import.meta.env.VITE_MEMFIRE_URL || 'https://d647ojgg91hgk1gnpfqg.baseapi.memfiredb.com'
const MEMFIRE_ANON_KEY = import.meta.env.VITE_MEMFIRE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImV4cCI6MzM0NzM1MjM5OCwiaWF0IjoxNzcwNTUyMzk4LCJpc3MiOiJzdXBhYmFzZSJ9.jWRdDqRdG9hx0UCDtHdM6xmUmmALuxFaQoaaLbIpmmU'

export const memFire = createClient(MEMFIRE_URL, MEMFIRE_ANON_KEY)
