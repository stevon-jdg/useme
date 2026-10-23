import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatNaira, koboToNaira, nairaToKobo } from '@/lib/formatting/money'
import { db, unwrap } from '@/lib/supabase/db'

type Settings = {
  standard_base_fee_kobo: number
  standard_per_km_kobo: number
  minimum_runner_fee_kobo: number
  platform_fee_percent: number
  platform_fee_minimum_kobo: number
}
type CategoryFee = { category_id: string; task_fee_kobo: number; errand_categories: { label: string } | null }

async function load() {
  const client = db()
  const [s, c] = await Promise.all([
    client
      .from('pricing_settings')
      .select('standard_base_fee_kobo, standard_per_km_kobo, minimum_runner_fee_kobo, platform_fee_percent, platform_fee_minimum_kobo')
      .eq('id', true)
      .single(),
    client.from('pricing_category_fees').select('category_id, task_fee_kobo, errand_categories(label)').order('category_id'),
  ])
  return { settings: unwrap(s) as Settings, fees: unwrap(c) as unknown as CategoryFee[] }
}

/** Mirrors calculate_standard_quote in the database. For the preview only; the database is what charges. */
function preview(s: Settings, taskKobo: number, km: number) {
  const distance = Math.round((km * s.standard_per_km_kobo) / 100) * 100
  const runner = Math.max(s.standard_base_fee_kobo + distance + taskKobo, s.minimum_runner_fee_kobo)
  const platform = Math.max(Math.round((runner * s.platform_fee_percent) / 100 / 100) * 100, s.platform_fee_minimum_kobo)
  return { runner, platform, total: runner + platform }
}

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix: string }) {
  return (
    <label className="block space-y-1 text-sm font-semibold">
      {label}
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base font-normal"
        />
        <span className="w-10 text-sm font-normal text-ink-soft">{suffix}</span>
      </div>
    </label>
  )
}

export function AdminPricingPage() {
  const { configured } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['admin-pricing'], queryFn: load, enabled: configured })

  const [f, setF] = useState({ base: '', perKm: '', min: '', pct: '', platMin: '' })
  const [tasks, setTasks] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!q.data) return
    const s = q.data.settings
    setF({
      base: String(koboToNaira(s.standard_base_fee_kobo)),
      perKm: String(koboToNaira(s.standard_per_km_kobo)),
      min: String(koboToNaira(s.minimum_runner_fee_kobo)),
      pct: String(s.platform_fee_percent),
      platMin: String(koboToNaira(s.platform_fee_minimum_kobo)),
    })
    setTasks(Object.fromEntries(q.data.fees.map((x) => [x.category_id, String(koboToNaira(x.task_fee_kobo))])))
  }, [q.data])

  function parsed(): { settings: Settings; fees: { id: string; kobo: number }[] } | null {
    const nums = [f.base, f.perKm, f.min, f.pct, f.platMin, ...Object.values(tasks)].map(Number)
    if (nums.some((n) => !Number.isFinite(n) || n < 0) || [f.base, f.perKm, f.min, f.pct, f.platMin, ...Object.values(tasks)].some((v) => v.trim() === '')) return null
    if (Number(f.pct) > 50) return null
    return {
      settings: {
        standard_base_fee_kobo: nairaToKobo(Number(f.base)),
        standard_per_km_kobo: nairaToKobo(Number(f.perKm)),
        minimum_runner_fee_kobo: nairaToKobo(Number(f.min)),
        platform_fee_percent: Number(f.pct),
        platform_fee_minimum_kobo: nairaToKobo(Number(f.platMin)),
      },
      fees: Object.entries(tasks).map(([id, v]) => ({ id, kobo: nairaToKobo(Number(v)) })),
    }
  }

  const p = parsed()
  const sampleTask = p?.fees.find((x) => x.id === 'pickup_delivery')?.kobo ?? 0
  const sample = p ? preview(p.settings, sampleTask, 2.6) : null

  async function save() {
    const data = parsed()
    if (!data) {
      setMsg({ tone: 'error', text: 'Check the numbers. All fields need a value of zero or more, and the percentage cannot pass 50.' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      unwrap(await db().from('pricing_settings').update(data.settings).eq('id', true))
      for (const fee of data.fees) {
        unwrap(await db().from('pricing_category_fees').update({ task_fee_kobo: fee.kobo }).eq('category_id', fee.id))
      }
      await qc.invalidateQueries({ queryKey: ['admin-pricing'] })
      setMsg({ tone: 'success', text: 'Saved. New errands use these prices straight away.' })
    } catch {
      setMsg({ tone: 'error', text: 'Could not save. Only admins can change prices.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Pricing" subtitle="Every customer pays one fixed fee set from these numbers." />
      {q.isLoading ? <p className="text-ink-soft" role="status">Loading…</p> : null}
      {q.error ? <Notice tone="error">We could not load pricing.</Notice> : null}
      {q.data ? (
        <>
          <Card className="space-y-3">
            <h2 className="font-bold">Runner fee</h2>
            <Field label="Base fee" value={f.base} onChange={(v) => setF({ ...f, base: v })} suffix="₦" />
            <Field label="Per kilometre" value={f.perKm} onChange={(v) => setF({ ...f, perKm: v })} suffix="₦/km" />
            <Field label="Minimum runner fee" value={f.min} onChange={(v) => setF({ ...f, min: v })} suffix="₦" />
          </Card>
          <Card className="space-y-3">
            <h2 className="font-bold">Task fee by errand type</h2>
            {q.data.fees.map((x) => (
              <Field
                key={x.category_id}
                label={x.errand_categories?.label ?? x.category_id}
                value={tasks[x.category_id] ?? ''}
                onChange={(v) => setTasks({ ...tasks, [x.category_id]: v })}
                suffix="₦"
              />
            ))}
          </Card>
          <Card className="space-y-3">
            <h2 className="font-bold">UseMe fee</h2>
            <Field label="Percentage of the runner fee" value={f.pct} onChange={(v) => setF({ ...f, pct: v })} suffix="%" />
            <Field label="Minimum UseMe fee" value={f.platMin} onChange={(v) => setF({ ...f, platMin: v })} suffix="₦" />
          </Card>
          {sample ? (
            <Card className="space-y-1">
              <p className="text-sm text-ink-soft">Example: a 2.6 km pickup and delivery</p>
              <p className="text-2xl font-extrabold tabular-nums">{formatNaira(sample.total)}</p>
              <p className="text-sm text-ink-soft">
                Runner {formatNaira(sample.runner)} · UseMe {formatNaira(sample.platform)}
              </p>
            </Card>
          ) : null}
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          <Button fullWidth size="lg" onClick={() => void save()} loading={saving}>
            Save prices
          </Button>
        </>
      ) : null}
    </div>
  )
}
