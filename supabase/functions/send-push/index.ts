// Supabase Edge Function: sends Web Push notifications. Called by ONE Database Webhook:
//   notifications INSERT -> pushes the same title and text the person sees in the app's bell.
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

  if (hook.table !== 'notifications') return ok({ skipped: true })
  const r = hook.record
  const userId = String(r.user_id ?? '')
  if (!userId) return ok({ skipped: true })
  const kind = String(r.kind ?? 'general')
  const payload = {
    title: String(r.title ?? 'UseMe'),
    body: String(r.body ?? ''),
    url: typeof r.link === 'string' && r.link.startsWith('/') ? r.link : '/',
    tag: kind === 'message' ? `chat-${String(r.errand_id ?? '')}` : kind,
  }

  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: kind === 'dispatch' ? 20 : 3600, urgency: 'high' },
      )
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
    }
  }
  return ok({ sent })
})
