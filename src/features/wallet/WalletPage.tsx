import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatNaira } from '@/lib/formatting/money'
import { fetchWallet } from './walletApi'

export function WalletPage() {
  const { configured } = useAuth()
  const q = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet, enabled: configured })
  const w = q.data

  return (
    <div className="space-y-4">
      <PageHeader title="Wallet" subtitle="What you have spent on errands." />
      {q.error ? <Notice tone="error">We could not load your wallet.</Notice> : null}
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-soft">Total spent</p>
          <p className="text-xs text-ink-soft">{w?.customer_orders ?? 0} completed errands</p>
        </div>
        <p className="text-2xl font-extrabold tabular-nums">{formatNaira(w?.customer_spent_kobo ?? 0)}</p>
      </Card>
      <Notice tone="info">
        You pay your runner in cash when the errand is done. Anything extra for items or a bigger job is agreed with the runner in chat. Card and transfer payments come later.
      </Notice>
    </div>
  )
}
