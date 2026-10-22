import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'

const planned = [
  'Errand search and status history',
  'Disputes and support tickets',
  'Pricing and service area configuration',
  'Audit log',
]

export function AdminHome() {
  return (
    <div className="space-y-4">
      <PageHeader title="Administration" />
      <Notice tone="info">
        No numbers are shown here on purpose. Admin figures will come from real database records, never sample data.
      </Notice>
      <Card className="space-y-3">
        <h2 className="font-bold">Runner applications</h2>
        <p className="text-sm text-ink-soft">Review, approve or reject people who applied to be runners.</p>
        <ButtonLink to="/admin/runners">Open applications</ButtonLink>
      </Card>
      <Card>
        <h2 className="font-bold">Planned for Phase 8</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {planned.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
