import type { QueryClient } from '@tanstack/react-query'

import { tsr } from '@/lib/ts-rest'

export const ALL_ATTACHMENTS_QUERY_KEY = ['/api/attachments/all']

/**
 * Uploads files to R2 via the presigned URL flow and records each one.
 * Invalidates the per-task and all-attachments query caches on completion.
 * Returns an array of error messages for any files that failed (empty = all succeeded).
 */
export async function uploadFiles(
  files: File[],
  taskId: number,
  queryClient: QueryClient,
): Promise<string[]> {
  const errors: string[] = []

  for (const file of files) {
    try {
      const urlRes = await tsr.attachments.getUploadUrl({
        body: {
          taskId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
        },
      })
      if (urlRes.status !== 200) {
        errors.push(`Failed to upload "${file.name}"`)
        continue
      }
      const { uploadUrl, key } = urlRes.body

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
      if (!uploadRes.ok) {
        errors.push(`Failed to upload "${file.name}"`)
        continue
      }

      const createRes = await tsr.attachments.create({
        body: {
          taskId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          r2Key: key,
        },
      })
      if (createRes.status !== 201) {
        errors.push(`Failed to save "${file.name}"`)
      }
    } catch {
      errors.push(`Failed to upload "${file.name}"`)
    }
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['/api/attachments', taskId] }),
    queryClient.invalidateQueries({ queryKey: ALL_ATTACHMENTS_QUERY_KEY }),
  ])

  return errors
}
