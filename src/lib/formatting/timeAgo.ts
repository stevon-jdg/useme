/** "just now", "5 min ago", "3 h ago", "yesterday", or a short date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}
