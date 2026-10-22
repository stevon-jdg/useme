import { ErrandCard } from '@/components/errands/ErrandCard'
import { Button } from '@/components/ui/Button'
import { DemoBanner } from '@/components/ui/DemoBanner'
import { PageHeader } from '@/components/ui/PageHeader'
import { DEMO_RUNNER_JOBS } from '@/lib/demo/demoData'

export function RunnerJobsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Available errands" subtitle="Areas only. Exact addresses appear after you accept." />
      <DemoBanner>Sample jobs. Accepting needs the database and runner approval, built in Phase 5.</DemoBanner>
      {DEMO_RUNNER_JOBS.map((job) => (
        <ErrandCard
          key={job.id}
          errand={job}
          amount={job.runnerEarnings}
          amountLabel="Your earnings"
          action={
            <Button fullWidth disabled>
              Accept (not available yet)
            </Button>
          }
        />
      ))}
    </div>
  )
}
