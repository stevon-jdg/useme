import { db, unwrap } from '@/lib/supabase/db'
import { callRpc } from '@/lib/supabase/rpc'

export type AppNotification = {
  id: number
  kind: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  return unwrap(
    await db().from('notifications').select('id, kind, title, body, link, read_at, created_at').order('created_at', { ascending: false }).limit(30),
  ) as AppNotification[]
}

export const markRead = (ids?: number[]) => callRpc<void>('mark_notifications_read', ids ? { p_ids: ids } : {})
