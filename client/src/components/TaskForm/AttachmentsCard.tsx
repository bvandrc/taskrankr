/**
 * @fileoverview Attachment list and upload UI for an existing task.
 *
 * Staged uploads are buffered in local state — nothing hits the backend
 * until the parent form calls `commit()` via the forwarded ref. Cancelling the
 * form discards all pending uploads without any server interaction. Deletions
 * of existing attachments are applied immediately.
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
import {
  FileIcon,
  Lock,
  Paperclip,
  Trash2,
  Upload,
  X as XIcon,
} from 'lucide-react'

import { Spinner } from '@/components/primitives/Spinner'
import { useAttachments, validateFile } from '@/hooks/useAttachments'
import { tsr } from '@/lib/ts-rest'
import { cn, handleKeyDown } from '@/lib/utils'
import { useGuestMode } from '@/providers/GuestModeProvider'
import { formatFileSize } from '~/shared/fileSize'
import type { Attachment } from '~/shared/schema'
import { Button } from '../primitives/Button'

const ALL_ATTACHMENTS_QUERY_KEY = ['/api/attachments/all']

export interface AttachmentsCardHandle {
  /**
   * Uploads all staged files. Returns `false` if any upload failed
   * (form should stay open).
   */
  commit(): Promise<boolean>
}

interface StagedFile {
  clientKey: string
  file: File
}

type IconComponent = React.ComponentType<{ className?: string }>

interface FileRowProps {
  icon: IconComponent
  name: string
  sizeLabel: string
  onNameClick?: () => void
  nameTestId?: string
  onAction: () => void
  actionIcon: IconComponent
  actionDisabled?: boolean
  actionLabel: string
  actionTestId: string
  dimmed?: boolean
  'data-testid': string
}

const FileRow = ({
  icon: Icon,
  name,
  sizeLabel,
  onNameClick,
  nameTestId,
  onAction,
  actionIcon: ActionIcon,
  actionDisabled,
  actionLabel,
  actionTestId,
  dimmed,
  'data-testid': testId,
}: FileRowProps) => (
  <div
    className={cn(
      'flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/10 group',
      dimmed ? 'opacity-60' : 'hover:bg-secondary/20',
    )}
    data-testid={testId}
  >
    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
    <div
      {...(onNameClick
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: onNameClick,
            onKeyDown: handleKeyDown,
          }
        : {})}
      data-testid={nameTestId}
      className="flex-1 min-w-0"
    >
      <span
        className={cn(
          'text-xs truncate block text-foreground/80',
          onNameClick && 'hover:text-foreground hover:underline',
        )}
      >
        {name}
      </span>
      <span className="text-[10px] text-muted-foreground">{sizeLabel}</span>
    </div>
    <button
      type="button"
      onClick={onAction}
      disabled={actionDisabled}
      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5 disabled:opacity-30"
      data-testid={actionTestId}
      aria-label={actionLabel}
    >
      <ActionIcon className="size-3.5" />
    </button>
  </div>
)

interface AttachmentRowProps {
  attachment: Attachment
  onDelete: (id: number) => void
  onDownload: (id: number, fileName: string) => void
  isDeleting: boolean
}

const AttachmentRow = ({
  attachment,
  onDelete,
  onDownload,
  isDeleting,
}: AttachmentRowProps) => (
  <FileRow
    icon={FileIcon}
    name={attachment.fileName}
    sizeLabel={formatFileSize(attachment.fileSize)}
    onNameClick={() => onDownload(attachment.id, attachment.fileName)}
    nameTestId={`attachment-download-${attachment.id}`}
    onAction={() => onDelete(attachment.id)}
    actionIcon={Trash2}
    actionDisabled={isDeleting}
    actionLabel="Delete attachment"
    actionTestId={`attachment-delete-${attachment.id}`}
    data-testid={`attachment-row-${attachment.id}`}
  />
)

interface StagedFileRowProps {
  staged: StagedFile
  onRemove: (clientKey: string) => void
}

const StagedFileRow = ({ staged, onRemove }: StagedFileRowProps) => (
  <FileRow
    icon={Upload}
    name={staged.file.name}
    sizeLabel={`${formatFileSize(staged.file.size)} · pending`}
    onAction={() => onRemove(staged.clientKey)}
    actionIcon={XIcon}
    actionLabel="Remove pending upload"
    actionTestId={`attachment-staged-remove-${staged.clientKey}`}
    dimmed
    data-testid={`attachment-staged-${staged.clientKey}`}
  />
)

interface AttachmentsCardProps {
  taskId: number
}

export const AttachmentsCard = forwardRef<
  AttachmentsCardHandle,
  AttachmentsCardProps
>(({ taskId }, ref) => {
  const { isGuestMode: disabled } = useGuestMode()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)

  const queryKey = useMemo(() => ['/api/attachments', taskId], [taskId])

  const { handleDelete, handleDownload, deletingId } = useAttachments(queryKey)

  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey,
    queryFn: async () => {
      const res = await tsr.attachments.list.query({ query: { taskId } })
      return res.status === 200 ? res.body : []
    },
    enabled: !disabled,
  })

  const totalCount = attachments.length + stagedFiles.length

  useImperativeHandle(ref, () => ({
    async commit() {
      if (disabled) return true
      setUploadError(null)
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

      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ALL_ATTACHMENTS_QUERY_KEY }),
      ])

      return success
    },
  }))

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (!file) return

      const error = validateFile(file)
      if (error) {
        setUploadError(error)
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
          <div className="px-2 py-1">
            <Spinner size="sm" />
          </div>
        ) : totalCount === 0 ? null : (
          <div className="flex flex-col gap-1">
            {attachments.map((a) => (
              <AttachmentRow
                key={a.id}
                attachment={a}
                onDelete={handleDelete}
                onDownload={handleDownload}
                isDeleting={deletingId === a.id}
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
