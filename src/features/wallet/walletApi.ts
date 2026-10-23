import { callRpc } from '@/lib/supabase/rpc'

export type Wallet = {
  customer_spent_kobo: number
  customer_orders: number
  runner_jobs: number
  runner_kept_kobo: number
  runner_commission_kobo: number
  runner_settled_kobo: number
  runner_owed_kobo: number
}

export type RunnerBalance = {
  runner_id: string
  full_name: string
  phone: string | null
  jobs: number
  commission_kobo: number
  settled_kobo: number
  owed_kobo: number
}

export const fetchWallet = () => callRpc<Wallet>('my_wallet')
export const fetchRunnerBalances = () => callRpc<RunnerBalance[]>('admin_runner_balances')
export const recordSettlement = (runner: string, amountKobo: number, note: string) =>
  callRpc<string>('admin_record_settlement', { p_runner: runner, p_amount_kobo: amountKobo, p_note: note.trim() === '' ? null : note.trim() })
