import { useState } from 'react'
import type { QueryKey } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'

import { tsr } from '@/lib/ts-rest'
import { useToast } from './useToast'

/**
 * Shared attachment actions (delete + download) for any component that lists
 * attachments. The caller provides the `queryKey` that should be invalidated
 * after a successful deletion.
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
      await queryClient.invalidateQueries({ queryKey })
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
        a.click()
      }
    } catch {
      toast({ title: 'Failed to get download link', variant: 'destructive' })
    }
  }

  return { handleDelete, handleDownload, deletingId }
}
