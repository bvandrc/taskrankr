import { useState } from 'react'
import type { QueryKey } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'

import { tsr } from '@/lib/ts-rest'
import { MAX_FILE_SIZE_BYTES } from '~/shared/fileAttachments'
import { formatFileSize } from '~/shared/fileSize'
import { useToast } from './useToast'

const ALL_ATTACHMENTS_QUERY_KEY = ['/api/attachments/all']

/** Returns an error message if `file` exceeds the per-file size limit, otherwise `null`. */
export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES)
    return `File must be under ${formatFileSize(MAX_FILE_SIZE_BYTES)}`
  return null
}

/**
 * Shared attachment actions (delete + download) for any component that lists
 * attachments. The caller provides the `queryKey` that should be invalidated
 * after a successful deletion — the global all-attachments key is always
 * invalidated too, keeping the storage meter in sync.
 */
export function useAttachments(queryKey: QueryKey) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      const res = await tsr.attachments.delete.mutate({ params: { id } })
      if (res.status !== 204) throw new Error()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ALL_ATTACHMENTS_QUERY_KEY }),
      ])
    } catch {
      toast({ title: 'Failed to delete attachment', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownload = async (id: number, fileName: string) => {
    try {
      const res = await tsr.attachments.getDownloadUrl.query({ params: { id } })
      if (res.status === 200) {
        const a = document.createElement('a')
        a.href = res.body.downloadUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch {
      toast({ title: 'Failed to get download link', variant: 'destructive' })
    }
  }

  return { handleDelete, handleDownload, deletingId }
}
