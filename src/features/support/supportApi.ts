import { callRpc } from '@/lib/supabase/rpc'

export const REASONS = [
  { id: 'no_show', label: 'Runner did not show up' },
  { id: 'wrong_fee', label: 'Fee or extra cash dispute' },
  { id: 'rude_behaviour', label: 'Rude or unsafe behaviour' },
  { id: 'item_problem', label: 'Item missing or damaged' },
  { id: 'safety', label: 'Safety concern' },
  { id: 'other', label: 'Something else' },
] as const

export type AdminReport = {
  id: string
  errand_id: string
  errand_title: string
  reporter_name: string
  reporter_phone: string | null
  reporter_role: 'Customer' | 'Runner'
  reason: string
  details: string | null
  status: 'open' | 'resolved'
  resolution_note: string | null
  created_at: string
  resolved_at: string | null
}

export const reportProblem = (errandId: string, reason: string, details: string) =>
  callRpc<string>('report_problem', { p_errand: errandId, p_reason: reason, p_details: details.trim() === '' ? null : details.trim() })
export const fetchReports = () => callRpc<AdminReport[]>('admin_list_reports')
export const resolveReport = (id: string, note: string) => callRpc<void>('admin_resolve_report', { p_report: id, p_note: note })
