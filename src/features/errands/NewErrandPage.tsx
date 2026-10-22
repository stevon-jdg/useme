import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { PriceBreakdown } from '@/components/errands/PriceBreakdown'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SelectField, TextAreaField } from '@/components/ui/Fields'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { TextField } from '@/components/ui/TextField'
import { nairaToKobo } from '@/lib/formatting/money'
import { calculatePrice } from '@/features/pricing/pricing'
import { ERRAND_CATEGORIES, TRANSPORT_TYPES, getCategory, getTransport } from './catalog'
import { errandSchema, parseNumber, type ErrandFormValues } from './errandSchema'

const STEPS = ['Details', 'Location', 'Review'] as const

const STEP_FIELDS: Record<number, FieldPath<ErrandFormValues>[]> = {
  0: ['category', 'title', 'description', 'shoppingBudget', 'instructions'],
  1: ['pickup', 'destination', 'transport', 'distanceKm', 'extraStops'],
}

export function NewErrandPage() {
  const [step, setStep] = useState(0)

  const {
    register,
    watch,
    trigger,
    formState: { errors },
  } = useForm<ErrandFormValues>({
    resolver: zodResolver(errandSchema),
    mode: 'onTouched',
    defaultValues: {
      category: 'pickup_delivery',
      title: '',
      description: '',
      pickup: '',
      destination: '',
      transport: 'keke',
      distanceKm: '',
      extraStops: '0',
      shoppingBudget: '',
      instructions: '',
    },
  })

  const values = watch()
  const category = getCategory(values.category)

  const price = useMemo(() => {
    const distanceKm = parseNumber(values.distanceKm)
    if (Number.isNaN(distanceKm) || distanceKm <= 0) return null
    const extraStops = parseNumber(values.extraStops || '0')
    const budget = parseNumber(values.shoppingBudget)
    try {
      return calculatePrice({
        category: values.category,
        transport: values.transport,
        distanceKm,
        extraStops: Number.isInteger(extraStops) && extraStops >= 0 ? extraStops : 0,
        shoppingBudget: category.allowsBudget && !Number.isNaN(budget) && budget > 0 ? nairaToKobo(budget) : 0,
      })
    } catch {
      return null
    }
  }, [values.category, values.transport, values.distanceKm, values.extraStops, values.shoppingBudget, category.allowsBudget])

  async function next() {
    const ok = await trigger(STEP_FIELDS[step])
    if (ok) setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Create an errand" subtitle="Tell us what you need. You see the price before anything is posted." />

      <ol className="flex items-center gap-2" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={index === step ? 'step' : undefined}>
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                index <= step ? 'bg-brand-red text-white' : 'bg-line text-ink-soft'
              }`}
            >
              {index + 1}
            </span>
            <span className={`text-sm ${index === step ? 'font-bold' : 'text-ink-soft'}`}>{label}</span>
          </li>
        ))}
      </ol>

      <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-4">
        {step === 0 ? (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">What do you need?</legend>
              {ERRAND_CATEGORIES.map((item) => (
                <label key={item.id} className="block cursor-pointer">
                  <input type="radio" value={item.id} className="peer sr-only" {...register('category')} />
                  <span className="block rounded-control border-2 border-line bg-surface p-3.5 peer-checked:border-brand-red peer-checked:bg-brand-red-soft peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-brand-orange">
                    <span className="block font-semibold">{item.label}</span>
                    <span className="block text-sm text-ink-soft">{item.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <TextField label="Task title" placeholder="e.g. Pick up food from Amala Spot" error={errors.title?.message} {...register('title')} />
            <TextAreaField label="Description (optional)" error={errors.description?.message} {...register('description')} />
            {category.allowsBudget ? (
              <TextField
                label="Shopping budget in naira (optional)"
                inputMode="numeric"
                placeholder="e.g. 5000"
                hint="Money for the items themselves. It is separate from the service cost and goes straight to the runner for purchases."
                error={errors.shoppingBudget?.message}
                {...register('shoppingBudget')}
              />
            ) : null}
            <TextAreaField label="Special instructions (optional)" error={errors.instructions?.message} {...register('instructions')} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <TextField
              label={category.needsDestination ? 'Pickup location' : 'Where should the runner go?'}
              placeholder="Area, street or landmark"
              error={errors.pickup?.message}
              {...register('pickup')}
            />
            {category.needsDestination ? (
              <TextField label="Destination" placeholder="Area, street or landmark" error={errors.destination?.message} {...register('destination')} />
            ) : null}
            <Notice tone="info">Map search and pin placement arrive in Phase 6. For now, describe each place in words.</Notice>
            <SelectField label="Runner transport" error={errors.transport?.message} {...register('transport')}>
              {TRANSPORT_TYPES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} (up to {item.maxKm} km)
                </option>
              ))}
            </SelectField>
            <TextField
              label="Approximate distance in km"
              inputMode="decimal"
              placeholder="e.g. 2.4"
              hint="Temporary field. Once maps are connected this is measured along the real route, not typed."
              error={errors.distanceKm?.message}
              {...register('distanceKm')}
            />
            <TextField label="Extra stops" inputMode="numeric" error={errors.extraStops?.message} {...register('extraStops')} />
          </>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <Card className="space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{category.label}</p>
              <p className="text-base font-bold">{values.title}</p>
              {values.description ? <p className="text-ink-soft">{values.description}</p> : null}
              <p className="pt-2">
                <span className="text-ink-soft">From: </span>
                {values.pickup}
              </p>
              {category.needsDestination ? (
                <p>
                  <span className="text-ink-soft">To: </span>
                  {values.destination}
                </p>
              ) : null}
              <p>
                <span className="text-ink-soft">Transport: </span>
                {getTransport(values.transport).label}, about {values.distanceKm} km
              </p>
            </Card>
            {price ? (
              <Card>
                <h2 className="mb-2 text-base font-bold">Price estimate</h2>
                <PriceBreakdown price={price} />
              </Card>
            ) : null}
            <Notice tone="warning">
              This is an estimate using sample rates, not final Jalingo prices. A real quote is calculated and saved by the
              server when posting is switched on. You will always be asked before the price rises.
            </Notice>
            <Notice tone="info">Posting an errand needs the database, which is built in Phase 5. Nothing is sent from this screen yet.</Notice>
          </div>
        ) : null}

        <div className="flex gap-3 pt-2">
          {step > 0 ? (
            <Button variant="secondary" size="lg" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button size="lg" fullWidth onClick={() => void next()}>
              Next
            </Button>
          ) : (
            <Button size="lg" fullWidth disabled>
              Post errand (soon)
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
