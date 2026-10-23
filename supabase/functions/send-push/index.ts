// Supabase Edge Function: sends Web Push notifications. Called by two Database Webhooks:
//   errand_dispatches INSERT -> tells the offered runner about a new request
//   errand_messages   INSERT -> tells the other person in the errand about a new message
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com), WEBHOOK_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// Deploy with "Verify JWT" OFF; the webhook is checked with the x-webhook-secret header instead.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Webhook = { type: string; table: string; record: Record<string, unknown> }

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET')
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return ok({ error: 'forbidden' }, 403)
  if (req.method !== 'POST') return ok({ error: 'method' }, 405)

  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!pub || !priv) return ok({ error: 'VAPID keys missing' }, 500)
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', pub, priv)

  const hook = (await req.json()) as Webhook
  if (hook.type !== 'INSERT') return ok({ skipped: true })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  let userId: string | null = null
  let payload: { title: string; body: string; url: string; tag: string } | null = null

  if (hook.table === 'errand_dispatches') {
    if (hook.record.status !== 'pending') return ok({ skipped: true })
    userId = String(hook.record.runner_id)
    payload = {
      title: 'New errand request',
      body: 'Open UseMe to accept or decline. It expires in about 20 seconds.',
      url: '/runner',
      tag: 'dispatch',
    }
  } else if (hook.table === 'errand_messages') {
    const errandId = String(hook.record.errand_id)
    const sender = String(hook.record.sender_id)
    const { data: errand } = await admin.from('errands').select('customer_id').eq('id', errandId).maybeSingle()
    const { data: asg } = await admin
      .from('errand_assignments')
      .select('runner_id')
      .eq('errand_id', errandId)
      .is('ended_at', null)
      .maybeSingle()
    if (!errand) return ok({ skipped: true })
    const toRunner = sender === errand.customer_id
    userId = toRunner ? (asg?.runner_id ?? null) : errand.customer_id
    if (!userId) return ok({ skipped: true })
    const text = String(hook.record.body ?? '').slice(0, 100)
    payload = {
      title: 'New message',
      body: text,
      url: toRunner ? '/runner' : `/app/errands/${errandId}`,
      tag: `chat-${errandId}`,
    }
  } else {
    return ok({ skipped: true })
  }

  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: hook.table === 'errand_dispatches' ? 20 : 3600, urgency: 'high' },
      )
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
    }
  }
  return ok({ sent })
})
