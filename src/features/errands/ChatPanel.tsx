import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Notice } from '@/components/ui/Notice'
import { useRealtimeRefresh } from '@/lib/supabase/useRealtime'
import { fetchMessages, markMessagesRead, sendMessage } from './rideApi'

type Props = {
  errandId: string
  meId: string
  otherName: string
  /** False once the errand is finished or cancelled. The history stays readable. */
  open: boolean
}

/** Chat between the customer and the runner on one errand. Messages are saved on the server before they appear. */
export function ChatPanel({ errandId, meId, otherName, open }: Props) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  const messages = useQuery({ queryKey: ['messages', errandId], queryFn: () => fetchMessages(errandId), refetchInterval: 8000 })
  useRealtimeRefresh('errand_messages', `errand_id=eq.${errandId}`, [['messages', errandId]])

  const list = messages.data ?? []
  const unread = list.filter((m) => m.sender_id !== meId && !m.read_at).length

  // Reading the chat marks the other person's messages as read.
  useEffect(() => {
    if (!expanded || unread === 0) return
    void markMessagesRead(errandId)
      .then(() => queryClient.invalidateQueries({ queryKey: ['messages', errandId] }))
      .catch(() => undefined)
  }, [expanded, unread, errandId, queryClient])

  useEffect(() => {
    if (expanded) bottom.current?.scrollIntoView({ block: 'end' })
  }, [expanded, list.length])

  async function send() {
    const body = text.trim()
    if (!body) return
    setSending(true)
    setError(null)
    try {
      await sendMessage(errandId, body)
      setText('')
      await queryClient.invalidateQueries({ queryKey: ['messages', errandId] })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section aria-label="Chat" className="rounded-card border border-line bg-surface">
      <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
        <MessageCircle className="size-6 text-brand-red" aria-hidden="true" />
        <span className="flex-1 font-bold">Chat with {otherName}</span>
        {unread > 0 ? <span className="grid min-w-6 place-items-center rounded-full bg-brand-red px-2 py-0.5 text-xs font-bold text-white" aria-label={`${unread} new`}>{unread}</span> : null}
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-line p-3">
          <div className="max-h-64 min-h-24 space-y-2 overflow-y-auto" role="log" aria-live="polite">
            {messages.isLoading ? <p className="text-sm text-ink-soft">Loading…</p> : null}
            {!messages.isLoading && list.length === 0 ? (
              <p className="text-sm text-ink-soft">No messages yet. Say hello, and agree anything extra here, like money for items or a bigger job.</p>
            ) : null}
            {list.map((m) => {
              const mine = m.sender_id === meId
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <p className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-brand-red text-white' : 'bg-canvas'}`}>{m.body}</p>
                </div>
              )
            })}
            <div ref={bottom} />
          </div>

          {messages.error ? <Notice tone="warning">Messages could not load. Retrying.</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}

          {open ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
              className="flex gap-2"
            >
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Type a message" aria-label="Message" className="min-h-12 flex-1 rounded-full border-2 border-line px-4 focus:border-brand-red focus:outline-none" />
              <button type="submit" disabled={sending || !text.trim()} aria-label="Send message" className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-red text-white disabled:opacity-50">
                <Send className="size-5" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <p className="text-center text-xs text-ink-soft">This chat is closed because the errand has ended.</p>
          )}
          <p className="text-xs text-ink-soft">Never share your delivery code until the errand is done. Money outside the service fee is settled between you and the runner.</p>
        </div>
      ) : null}
    </section>
  )
}
