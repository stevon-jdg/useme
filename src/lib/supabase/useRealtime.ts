import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from './client'

/**
 * Refetches the given queries the moment a row changes. It carries no data itself, so the screens
 * always show what the server says. If the connection drops, the screens' own slow polling still works.
 */
export function useRealtimeRefresh(table: string, filter: string | undefined, keys: QueryKey[], enabled = true) {
  const queryClient = useQueryClient()
  const signature = JSON.stringify(keys)

  useEffect(() => {
    if (!supabase || !enabled) return
    const client = supabase
    const channel = client
      .channel(`rt-${table}-${filter ?? 'all'}-${signature}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => {
        for (const key of JSON.parse(signature) as QueryKey[]) void queryClient.invalidateQueries({ queryKey: key })
      })
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [table, filter, signature, enabled, queryClient])
}
