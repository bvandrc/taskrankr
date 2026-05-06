/**
 * @fileoverview Attachment list and upload UI for an existing task.
 * Only rendered when the task has been saved (has a real positive ID).
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileIcon, Paperclip, Trash2, Upload } from 'lucide-react'

import { tsr } from '@/lib/ts-rest'
import type { Attachment } from '~/shared/schema'
import { Button } from '../primitives/Button'

const MAX_FILE_SIZE_MB = 50
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface AttachmentRowProps {
  attachment: Attachment
  onDelete: (id: number) => void
  isDeleting: boolean
}

const AttachmentRow = ({
  attachment,
  onDelete,
  isDeleting,
}: AttachmentRowProps) => {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await tsr.attachments.getDownloadUrl.query({
        params: { id: attachment.id },
      })
      if (res.status === 200) {
        window.open(res.body.downloadUrl, '_blank', 'noopener,noreferrer')
      }
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/10 hover:bg-secondary/20 group"
      data-testid={`attachment-row-${attachment.id}`}
    >
      <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={handleDownload}
        disabled={downloading}
        data-testid={`attachment-download-${attachment.id}`}
      >
        <span className="text-xs truncate block text-foreground/80 hover:text-foreground hover:underline">
          {attachment.fileName}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatFileSize(attachment.fileSize)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(attachment.id)}
        disabled={isDeleting}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5"
        data-testid={`attachment-delete-${attachment.id}`}
        aria-label="Delete attachment"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

interface AttachmentsCardProps {
  taskId: number
}

export const AttachmentsCard = ({ taskId }: AttachmentsCardProps) => {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const queryKey = useMemo(() => ['/api/attachments', taskId], [taskId])

  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey,
    queryFn: async () => {
      const res = await tsr.attachments.list.query({ query: { taskId } })
      return res.status === 200 ? res.body : []
    },
  })

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!fileInputRef.current) return
      fileInputRef.current.value = ''
      if (!file) return

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setUploadError(`File must be under ${MAX_FILE_SIZE_MB} MB`)
        return
      }

      setUploadError(null)
      setUploading(true)
      try {
        const urlRes = await tsr.attachments.getUploadUrl.mutate({
          body: {
            taskId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
          },
        })
        if (urlRes.status !== 200) {
          setUploadError('Could not get upload URL')
          return
        }
        const { uploadUrl, key } = urlRes.body

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        })
        if (!uploadRes.ok) {
          setUploadError('Upload failed. Please try again.')
          return
        }

        const createRes = await tsr.attachments.create.mutate({
          body: {
            taskId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            key,
          },
        })
        if (createRes.status === 201) {
          await queryClient.invalidateQueries({ queryKey })
        } else {
          setUploadError('Failed to save attachment')
        }
      } catch {
        setUploadError('Upload failed. Please try again.')
      } finally {
        setUploading(false)
      }
    },
    [taskId, queryClient, queryKey],
  )

  const handleDelete = useCallback(
    async (id: number) => {
      setDeletingId(id)
      try {
        const res = await tsr.attachments.delete.mutate({
          params: { id },
        })
        if (res.status === 204) {
          await queryClient.invalidateQueries({ queryKey })
        }
      } finally {
        setDeletingId(null)
      }
    },
    [queryClient, queryKey],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Paperclip className="size-3" />
          Attachments
          {attachments.length > 0 && (
            <span className="text-muted-foreground/60">
              ({attachments.length})
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
          data-testid="attachment-upload-button"
        >
          <Upload className="size-3" />
          {uploading ? 'Uploading…' : 'Add file'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          data-testid="attachment-file-input"
        />
      </div>

      {uploadError && (
        <p
          className="text-[11px] text-destructive"
          data-testid="attachment-upload-error"
        >
          {uploadError}
        </p>
      )}

      {isLoading ? (
        <div className="text-[11px] text-muted-foreground px-2">Loading…</div>
      ) : attachments.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/50 px-2">
          No attachments yet
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {attachments.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              onDelete={handleDelete}
              isDeleting={deletingId === a.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
