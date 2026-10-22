import type { RunnerStatus } from '@/features/account/useAccount'

type Tone = 'neutral' | 'red' | 'yellow' | 'green' | 'dark'

export const STATUS_INFO: Record<RunnerStatus, { label: string; tone: Tone; message: string }> = {
  draft: {
    label: 'Draft',
    tone: 'neutral',
    message: 'Finish your details and documents, then submit your application.',
  },
  submitted: {
    label: 'Submitted',
    tone: 'yellow',
    message: 'We received your application. A person at UseMe will review it. You cannot edit it while it is in review.',
  },
  under_review: {
    label: 'Under review',
    tone: 'yellow',
    message: 'A person at UseMe is reviewing your application right now.',
  },
  more_info_required: {
    label: 'More information needed',
    tone: 'red',
    message: 'We need something more from you. Read the note, update your application and submit it again.',
  },
  approved: {
    label: 'Approved',
    tone: 'green',
    message: 'You are approved. You can go available and take errands.',
  },
  rejected: {
    label: 'Not approved',
    tone: 'red',
    message: 'Your application was not approved.',
  },
  suspended: {
    label: 'Suspended',
    tone: 'red',
    message: 'Your runner account is suspended. Contact UseMe support to ask why.',
  },
}

export const DOCUMENT_LABEL: Record<string, string> = {
  id_document: 'Identity document',
  selfie: 'Selfie',
  vehicle_licence: 'Vehicle licence',
  vehicle_registration: 'Vehicle registration',
}

/** The application can only be changed while it is a draft or the admin asked for more. */
export function isEditable(status: RunnerStatus | undefined): boolean {
  return status === undefined || status === 'draft' || status === 'more_info_required'
}
