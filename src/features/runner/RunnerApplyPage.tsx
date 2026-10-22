import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { TextField } from '@/components/ui/TextField'
import { accountKey, useAccount } from '@/features/account/useAccount'
import { useAuth } from '@/features/auth/AuthProvider'
import { runnerApplicationSchema, type RunnerApplicationValues } from '@/lib/validation/runner'
import { uploadRunnerDocument } from '@/services/files/uploadFile'
import {
  fetchMyDocuments,
  fetchSavedApplication,
  fetchServiceArea,
  registerDocument,
  saveApplication,
  submitApplication,
  type SavedApplication,
} from './runnerApi'
import { fetchTransportOptions, type TransportOption } from './runnerLookups'
import { DOCUMENT_LABEL, STATUS_INFO, isEditable } from './status'

const docsKey = (userId: string | undefined) => ['runner-docs', userId] as const
const savedKey = (userId: string | undefined) => ['runner-saved', userId] as const

export function RunnerApplyPage() {
  const { user, configured } = useAuth()
  const { account } = useAccount()
  const userId = user?.id
  const enabled = configured && Boolean(userId)

  const area = useQuery({ queryKey: ['service-area'], queryFn: fetchServiceArea, enabled })
  const transports = useQuery({ queryKey: ['transport-options'], queryFn: fetchTransportOptions, enabled })
  const saved = useQuery({ queryKey: savedKey(userId), queryFn: () => fetchSavedApplication(userId as string), enabled })
  const docs = useQuery({ queryKey: docsKey(userId), queryFn: () => fetchMyDocuments(userId as string), enabled })

  if (!configured) {
    return (
      <div className="space-y-4">
        <PageHeader title="Become a runner" />
        <Notice tone="warning">
          Runner applications need the app to be connected to Supabase. Add your values to .env.local and restart.
        </Notice>
      </div>
    )
  }

  const failed = area.error ?? transports.error ?? saved.error ?? docs.error
  if (failed) {
    return (
      <div className="space-y-4">
        <PageHeader title="Become a runner" />
        <Notice tone="error">Could not load the application. {(failed as Error).message}</Notice>
        <Button
          onClick={() => {
            void area.refetch()
            void transports.refetch()
            void saved.refetch()
            void docs.refetch()
          }}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (!area.data || !transports.data || saved.data === undefined || !docs.data || !account) {
    return (
      <div className="space-y-4">
        <PageHeader title="Become a runner" />
        <p className="text-ink-soft" role="status">
          Loading…
        </p>
      </div>
    )
  }

  const status = account.runner?.status
  const info = status ? STATUS_INFO[status] : null
  const editable = isEditable(status)

  return (
    <div className="space-y-5">
      <PageHeader title="Become a runner" subtitle="Earn money running errands in Jalingo. A person reviews every application." />

      {info ? (
        <Card className="space-y-2">
          <Badge tone={info.tone}>{info.label}</Badge>
          <p className="text-sm">{info.message}</p>
          {account.runner?.reviewNote ? (
            <p className="rounded-control bg-canvas p-3 text-sm">
              <span className="font-semibold">Note from UseMe: </span>
              {account.runner.reviewNote}
            </p>
          ) : null}
        </Card>
      ) : null}

      {editable ? (
        <>
          <ApplicationForm
            userId={userId as string}
            serviceAreaId={area.data.id}
            transports={transports.data}
            saved={saved.data}
          />
          {saved.data ? (
            <DocumentsAndSubmit
              userId={userId as string}
              transports={transports.data}
              saved={saved.data}
              documents={docs.data}
            />
          ) : (
            <Notice tone="info">Save your details first. Then you can upload your documents and submit.</Notice>
          )}
        </>
      ) : null}
    </div>
  )
}

function ApplicationForm({
  userId,
  serviceAreaId,
  transports,
  saved,
}: {
  userId: string
  serviceAreaId: string
  transports: TransportOption[]
  saved: SavedApplication | null
}) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const [savedNow, setSavedNow] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RunnerApplicationValues>({
    resolver: zodResolver(runnerApplicationSchema),
    defaultValues: {
      legalName: saved?.legal_name ?? '',
      dateOfBirth: saved?.date_of_birth ?? '',
      emergencyName: saved?.emergency_contact_name ?? '',
      emergencyPhone: saved?.emergency_contact_phone ?? '',
      emergencyConsent: Boolean(saved?.emergency_consent_at),
      conductAccepted: Boolean(saved?.conduct_accepted_at),
      transports: saved?.transports.map((item) => item.transport_id) ?? [],
      plates: Object.fromEntries((saved?.transports ?? []).map((item) => [item.transport_id, item.plate_number ?? ''])),
    },
  })

  const chosen = watch('transports') ?? []

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    setSavedNow(false)
    const parsed = runnerApplicationSchema.parse(values)
    const plates = Object.fromEntries(
      parsed.transports.map((id) => [id, (parsed.plates[id] ?? '').trim()]).filter(([, plate]) => plate !== ''),
    )
    try {
      await saveApplication({
        legalName: parsed.legalName,
        dateOfBirth: parsed.dateOfBirth,
        serviceAreaId,
        emergencyName: parsed.emergencyName,
        emergencyPhone: parsed.emergencyPhone,
        emergencyConsent: parsed.emergencyConsent,
        conductAccepted: parsed.conductAccepted,
        transports: parsed.transports,
        plates,
      })
      setSavedNow(true)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: savedKey(userId) }),
        queryClient.invalidateQueries({ queryKey: accountKey(userId) }),
      ])
    } catch (error) {
      setFormError((error as Error).message)
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <h2 className="text-lg font-bold">1. Your details</h2>
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {savedNow ? <Notice tone="success">Saved. Now upload your documents below.</Notice> : null}

      <TextField label="Full legal name" autoComplete="name" error={errors.legalName?.message} {...register('legalName')} />
      <TextField
        label="Date of birth"
        type="date"
        hint="You must be at least 18."
        error={errors.dateOfBirth?.message}
        {...register('dateOfBirth')}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How will you travel?</legend>
        {transports.map((item) => (
          <label key={item.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-line bg-surface px-3.5">
            <input type="checkbox" value={item.id} className="size-5 accent-brand-red" {...register('transports')} />
            <span className="font-medium">{item.label}</span>
            {item.requires_vehicle_check ? <span className="text-xs text-ink-soft">needs licence</span> : null}
          </label>
        ))}
        {errors.transports?.message ? <p className="text-sm font-medium text-brand-red">{errors.transports.message}</p> : null}
      </fieldset>

      {transports
        .filter((item) => item.requires_vehicle_check && chosen.includes(item.id))
        .map((item) => (
          <TextField
            key={item.id}
            label={`${item.label} plate number (optional)`}
            autoCapitalize="characters"
            {...register(`plates.${item.id}`)}
          />
        ))}

      <h2 className="pt-2 text-lg font-bold">Emergency contact</h2>
      <p className="text-sm text-ink-soft">
        Someone we can call if there is a problem on a job. Only UseMe administrators can see this.
      </p>
      <TextField label="Contact name" error={errors.emergencyName?.message} {...register('emergencyName')} />
      <TextField label="Contact phone" type="tel" inputMode="tel" error={errors.emergencyPhone?.message} {...register('emergencyPhone')} />

      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-brand-red" {...register('emergencyConsent')} />
        <span className="text-sm">I agree that UseMe may store this contact and call them in an emergency.</span>
      </label>
      {errors.emergencyConsent?.message ? <p className="text-sm font-medium text-brand-red">{errors.emergencyConsent.message}</p> : null}

      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-brand-red" {...register('conductAccepted')} />
        <span className="text-sm">
          I accept the runner code of conduct: I will be honest, treat customers with respect, and never carry prohibited
          items.
        </span>
      </label>
      {errors.conductAccepted?.message ? <p className="text-sm font-medium text-brand-red">{errors.conductAccepted.message}</p> : null}

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Save details
      </Button>
    </form>
  )
}

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

function DocumentsAndSubmit({
  userId,
  transports,
  saved,
  documents,
}: {
  userId: string
  transports: TransportOption[]
  saved: SavedApplication
  documents: { id: string; kind: string }[]
}) {
  const queryClient = useQueryClient()
  const [busyKind, setBusyKind] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const needsVehicle = saved.transports.some(
    (item) => transports.find((option) => option.id === item.transport_id)?.requires_vehicle_check,
  )
  const required = ['id_document', 'selfie', ...(needsVehicle ? ['vehicle_licence'] : [])]
  const optional = needsVehicle ? ['vehicle_registration'] : []
  const have = new Set(documents.map((doc) => doc.kind))
  const complete = required.every((kind) => have.has(kind))

  async function upload(kind: string, file: File | undefined) {
    if (!file) return
    setBusyKind(kind)
    setError(null)
    try {
      const path = await uploadRunnerDocument(userId, kind, file)
      await registerDocument(kind, path)
      await queryClient.invalidateQueries({ queryKey: docsKey(userId) })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyKind(null)
    }
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      await submitApplication()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountKey(userId) }),
        queryClient.invalidateQueries({ queryKey: docsKey(userId) }),
      ])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="docs-heading">
      <h2 id="docs-heading" className="text-lg font-bold">
        2. Documents
      </h2>
      <p className="text-sm text-ink-soft">
        JPG, PNG, WebP or PDF, up to 5 MB each. Only you and UseMe administrators can open these files. Uploading a file does
        not verify you. A person checks it.
      </p>
      {error ? <Notice tone="error">{error}</Notice> : null}

      {[...required, ...optional].map((kind) => {
        const done = have.has(kind)
        const isRequired = required.includes(kind)
        return (
          <Card key={kind} className="space-y-2">
            <div className="flex items-center gap-2">
              {done ? (
                <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
              ) : (
                <Circle className="size-5 text-ink-soft" aria-hidden="true" />
              )}
              <p className="font-semibold">{DOCUMENT_LABEL[kind] ?? kind}</p>
              <span className="text-xs text-ink-soft">{done ? 'Uploaded' : isRequired ? 'Required' : 'Optional'}</span>
            </div>
            <label className="block">
              <span className="sr-only">Choose a file for {DOCUMENT_LABEL[kind] ?? kind}</span>
              <input
                type="file"
                accept={ACCEPT}
                capture={kind === 'selfie' ? 'user' : undefined}
                disabled={busyKind !== null}
                onChange={(event) => {
                  void upload(kind, event.target.files?.[0])
                  event.target.value = ''
                }}
                className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-control file:border-0 file:bg-ink file:px-4 file:font-semibold file:text-white"
              />
            </label>
            {busyKind === kind ? <p className="text-sm text-ink-soft" role="status">Uploading…</p> : null}
          </Card>
        )
      })}

      <Button size="lg" fullWidth loading={submitting} disabled={!complete || busyKind !== null} onClick={() => void submit()}>
        Submit application
      </Button>
      {!complete ? <p className="text-center text-sm text-ink-soft">Upload the required documents to submit.</p> : null}
    </section>
  )
}
