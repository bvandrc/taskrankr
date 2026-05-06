/**
 * @fileoverview Attachment list and upload UI for an existing task.
 *
 * Uploads and deletions are buffered in local state — nothing hits the backend
 * until the parent form calls `commit()` via the forwarded ref. Cancelling the
 * form discards all pending changes without any server interaction.
 *
 * Only rendered when the task has been saved (positive ID).
 */

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileIcon, Lock, Paperclip, Trash2, Upload, X } from 'lucide-react'

import { tsr } from '@/lib/ts-rest'
import { MAX_FILE_SIZE_BYTES } from '~/shared/fileAttachments'
import { formatFileSize } from '~/shared/fileSize'
import type { Attachment } from '~/shared/schema'
import { Button } from '../primitives/Button'

export interface AttachmentsCardHandle {
  /**
   * Uploads all staged files and executes pending deletions.
   * Returns `false` if any upload failed (form should stay open).
   */
  commit(): Promise<boolean>
}

interface StagedFile {
  clientKey: string
  file: File
}

interface AttachmentRowProps {
  attachment: Attachment
  onDelete: (id: number) => void
}

const AttachmentRow = ({ attachment, onDelete }: AttachmentRowProps) => {
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
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5"
        data-testid={`attachment-delete-${attachment.id}`}
        aria-label="Delete attachment"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

interface StagedFileRowProps {
  staged: StagedFile
  onRemove: (clientKey: string) => void
}

const StagedFileRow = ({ staged, onRemove }: StagedFileRowProps) => (
  <div
    className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/10 group opacity-60"
    data-testid={`attachment-staged-${staged.clientKey}`}
  >
    <Upload className="size-3.5 shrink-0 text-muted-foreground" />
    <div className="flex-1 min-w-0">
      <span className="text-xs truncate block text-foreground/80">
        {staged.file.name}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {formatFileSize(staged.file.size)} · pending
      </span>
    </div>
    <button
      type="button"
      onClick={() => onRemove(staged.clientKey)}
      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5"
      data-testid={`attachment-staged-remove-${staged.clientKey}`}
      aria-label="Remove pending upload"
    >
      <X className="size-3.5" />
    </button>
  </div>
)

interface AttachmentsCardProps {
  taskId: number
  disabled?: boolean
}

export const AttachmentsCard = forwardRef<
  AttachmentsCardHandle,
  AttachmentsCardProps
>(({ taskId, disabled = false }, ref) => {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(new Set())
  const [uploadError, setUploadError] = useState<string | null>(null)

  const queryKey = useMemo(() => ['/api/attachments', taskId], [taskId])

  const { data: fetchedAttachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey,
    queryFn: async () => {
      const res = await tsr.attachments.list.query({ query: { taskId } })
      return res.status === 200 ? res.body : []
    },
    enabled: !disabled,
  })

  const visibleAttachments = useMemo(
    () => fetchedAttachments.filter((a) => !pendingDeletes.has(a.id)),
    [fetchedAttachments, pendingDeletes],
  )

  const totalCount = visibleAttachments.length + stagedFiles.length

  useImperativeHandle(ref, () => ({
    async commit() {
      if (disabled) return true
      let success = true

      for (const staged of [...stagedFiles]) {
        try {
          const urlRes = await tsr.attachments.getUploadUrl.mutate({
            body: {
              taskId,
              fileName: staged.file.name,
              fileSize: staged.file.size,
              mimeType: staged.file.type || 'application/octet-stream',
            },
          })
          if (urlRes.status !== 200) {
            setUploadError(`Failed to upload "${staged.file.name}"`)
            success = false
            continue
          }
          const { uploadUrl, key } = urlRes.body

          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: staged.file,
            headers: {
              'Content-Type': staged.file.type || 'application/octet-stream',
            },
          })
          if (!uploadRes.ok) {
            setUploadError(`Failed to upload "${staged.file.name}"`)
            success = false
            continue
          }

          const createRes = await tsr.attachments.create.mutate({
            body: {
              taskId,
              fileName: staged.file.name,
              fileSize: staged.file.size,
              mimeType: staged.file.type || 'application/octet-stream',
              r2Key: key,
            },
          })
          if (createRes.status === 201) {
            setStagedFiles((prev) =>
              prev.filter((sf) => sf.clientKey !== staged.clientKey),
            )
          } else {
            setUploadError(`Failed to save "${staged.file.name}"`)
            success = false
          }
        } catch {
          setUploadError(`Failed to upload "${staged.file.name}"`)
          success = false
        }
      }

      for (const id of [...pendingDeletes]) {
        try {
          await tsr.attachments.delete.mutate({ params: { id } })
          setPendingDeletes((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        } catch {
          // Best-effort — a failed delete doesn't block form save
        }
      }

      if (success) {
        await queryClient.invalidateQueries({ queryKey })
      }

      return success
    },
  }))

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (!file) return

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setUploadError(
          `File must be under ${formatFileSize(MAX_FILE_SIZE_BYTES)}`,
        )
        return
      }

      setUploadError(null)
      setStagedFiles((prev) => [
        ...prev,
        { clientKey: crypto.randomUUID(), file },
      ])
    },
    [],
  )

  const handleDeleteExisting = useCallback((id: number) => {
    setPendingDeletes((prev) => new Set([...prev, id]))
  }, [])

  const handleRemoveStaged = useCallback((clientKey: string) => {
    setStagedFiles((prev) => prev.filter((sf) => sf.clientKey !== clientKey))
  }, [])

  return (
    <div className={disabled ? 'opacity-50' : undefined}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Paperclip className="size-3" />
            Attachments
            {disabled ? (
              <span className="flex items-center gap-0.5 text-muted-foreground/60">
                <Lock className="size-2.5" />
                Logged in only
              </span>
            ) : (
              totalCount > 0 && (
                <span className="text-muted-foreground/60">({totalCount})</span>
              )
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
            data-testid="attachment-upload-button"
          >
            <Upload className="size-3" />
            Add file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            data-testid="attachment-file-input"
          />
        </div>

        {!disabled && uploadError && (
          <p
            className="text-[11px] text-destructive"
            data-testid="attachment-upload-error"
          >
            {uploadError}
          </p>
        )}

        {disabled ? (
          <div className="text-[11px] text-muted-foreground/50 px-2">
            Sign in to attach files to your tasks
          </div>
        ) : isLoading ? (
          <div className="text-[11px] text-muted-foreground px-2">Loading…</div>
        ) : totalCount === 0 ? (
          <div className="text-[11px] text-muted-foreground/50 px-2">
            No attachments yet
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {visibleAttachments.map((a) => (
              <AttachmentRow
                key={a.id}
                attachment={a}
                onDelete={handleDeleteExisting}
              />
            ))}
            {stagedFiles.map((sf) => (
              <StagedFileRow
                key={sf.clientKey}
                staged={sf}
                onRemove={handleRemoveStaged}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

AttachmentsCard.displayName = 'AttachmentsCard'
