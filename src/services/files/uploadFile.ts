import { db } from '@/lib/supabase/db'

/**
 * File upload lives behind this small module so a native camera or file picker can replace
 * it when the app is wrapped with Capacitor. Nothing else touches storage directly.
 */

export const RUNNER_DOCUMENT_BUCKET = 'runner-documents'
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** Returns a message when the file is not allowed, or null when it is fine. */
export function checkUploadFile(file: { size: number; type: string }): string | null {
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    return 'Use a JPG, PNG, WebP or PDF file.'
  }
  if (file.size > MAX_UPLOAD_BYTES) return 'The file is too large. The limit is 5 MB.'
  if (file.size === 0) return 'The file is empty.'
  return null
}

/** Uploads into the caller's own folder. Returns the storage path. */
export async function uploadRunnerDocument(userId: string, kind: string, file: File): Promise<string> {
  const problem = checkUploadFile(file)
  if (problem) throw new Error(problem)

  const path = `${userId}/${kind}-${Date.now()}.${EXTENSIONS[file.type]}`
  const { error } = await db().storage.from(RUNNER_DOCUMENT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

export async function removeRunnerDocumentFile(path: string): Promise<void> {
  // Best effort cleanup. Browsers cannot delete under our policies, so this may be refused.
  await db().storage.from(RUNNER_DOCUMENT_BUCKET).remove([path])
}

/** A short-lived link for an administrator to open a document. */
export async function signedDocumentUrl(path: string): Promise<string> {
  const { data, error } = await db().storage.from(RUNNER_DOCUMENT_BUCKET).createSignedUrl(path, 60)
  if (error || !data) throw new Error(error?.message ?? 'Could not open the document')
  return data.signedUrl
}
