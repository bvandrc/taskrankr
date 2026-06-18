/**
 * @fileoverview File Attachments management page.
 * Lists all of the authenticated user's attachments across every task,
 * showing storage usage, associated task status, and per-file delete controls.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileIcon, Paperclip, Trash2 } from 'lucide-react'

import { BackButtonHeader } from '@/components/BackButton'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ProgressBar } from '@/components/primitives/ProgressBar'
import { ScrollablePage } from '@/components/primitives/ScrollablePage'
import { Spinner } from '@/components/primitives/Spinner'
import { useAttachments } from '@/hooks/useAttachments'
import { ALL_ATTACHMENTS_QUERY_KEY } from '@/lib/attachment-upload'
import { tsr } from '@/lib/ts-rest'
import { MAX_TOTAL_STORAGE_BYTES } from '~/shared/fileAttachments'
import { formatFileSize } from '~/shared/fileSize'
import type { AttachmentWithTask } from '~/shared/schema'
import { TaskStatus } from '~/shared/schema'
import { formatDaysSince } from '~/shared/utils/datetime'

const StorageMeter = ({ totalBytes }: { totalBytes: number }) => (
  <div
    className="flex flex-col gap-2 px-4 py-3 rounded-lg bg-card border border-white/5"
    data-testid="storage-meter"
  >
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground font-medium">
        Total storage used
      </span>
      <span className="font-mono text-foreground/80 text-xs">
        {formatFileSize(totalBytes)}{' '}
        <span className="text-muted-foreground">
          / {formatFileSize(MAX_TOTAL_STORAGE_BYTES)}
        </span>
      </span>
    </div>
    <ProgressBar value={totalBytes / MAX_TOTAL_STORAGE_BYTES} />
  </div>
)

const StatusCell = ({
  taskStatus,
  taskCompletedAt,
}: {
  taskStatus: string
  taskCompletedAt: Date | null
}) =>
  taskStatus === TaskStatus.COMPLETED ? (
    <span
      className="text-xs text-muted-foreground shrink-0 whitespace-nowrap"
      data-testid="badge-completed"
    >
      {taskCompletedAt ? formatDaysSince(taskCompletedAt) : 'Completed'}
    </span>
  ) : (
    <Badge
      variant="outline"
      className="text-xs shrink-0"
      data-testid="badge-open"
    >
      Open
    </Badge>
  )

const AttachmentRow = ({
  attachment,
  onDelete,
  onDownload,
  isDeleting,
}: {
  attachment: AttachmentWithTask
  onDelete: (id: number) => void
  onDownload: (id: number, fileName: string) => void
  isDeleting: boolean
}) => (
  <div
    className="flex items-start gap-3 px-4 py-3 rounded-lg bg-card border border-white/5 hover:border-white/10 transition-colors"
    data-testid={`attachment-row-${attachment.id}`}
  >
    <FileIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />

    <div className="flex-1 min-w-0">
      <button
        type="button"
        className="text-sm font-medium text-foreground hover:underline text-left truncate w-full"
        onClick={() => onDownload(attachment.id, attachment.fileName)}
        data-testid={`button-download-${attachment.id}`}
      >
        {attachment.fileName}
      </button>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {attachment.taskName}
      </p>
    </div>

    <div className="flex items-center gap-2 shrink-0 self-center">
      <StatusCell
        taskStatus={attachment.taskStatus}
        taskCompletedAt={attachment.taskCompletedAt}
      />
      <span className="text-xs text-muted-foreground font-mono w-16 text-right">
        {formatFileSize(attachment.fileSize)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(attachment.id)}
        disabled={isDeleting}
        data-testid={`button-delete-attachment-${attachment.id}`}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  </div>
)

const EmptyState = () => (
  <div
    className="flex flex-col items-center justify-center gap-3 py-16 text-center"
    data-testid="empty-state-attachments"
  >
    <Paperclip className="size-8 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">No attachments yet</p>
    <p className="text-xs text-muted-foreground/70">
      Attach files to your tasks and they will appear here.
    </p>
  </div>
)

const FileAttachments = () => {
  const { handleDelete, handleDownload, deletingId } = useAttachments(
    ALL_ATTACHMENTS_QUERY_KEY,
  )

  const { data = [], isLoading } = useQuery<AttachmentWithTask[]>({
    queryKey: ALL_ATTACHMENTS_QUERY_KEY,
    queryFn: async () => {
      const res = await tsr.attachments.listAll()
      return res.status === 200 ? res.body : []
    },
  })

  const attachments = useMemo(
    () =>
      data.slice().sort((a, b) => {
        const aOpen = a.taskStatus !== TaskStatus.COMPLETED
        const bOpen = b.taskStatus !== TaskStatus.COMPLETED
        if (aOpen !== bOpen) return aOpen ? -1 : 1
        if (!aOpen && !bOpen) {
          return (
            (a.taskCompletedAt?.getTime() ?? 0) -
            (b.taskCompletedAt?.getTime() ?? 0)
          )
        }
        return 0
      }),
    [data],
  )

  const totalBytes = useMemo(
    () => data.reduce((sum, a) => sum + a.fileSize, 0),
    [data],
  )

  return (
    <ScrollablePage>
      <BackButtonHeader title="File Attachments" />

      <div className="flex flex-col gap-4">
        <StorageMeter totalBytes={totalBytes} />

        {isLoading ? (
          <Spinner centered />
        ) : attachments.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground px-1">
              {attachments.length} attachment
              {attachments.length !== 1 ? 's' : ''}
            </p>
            {attachments.map((attachment) => (
              <AttachmentRow
                key={attachment.id}
                attachment={attachment}
                onDelete={handleDelete}
                onDownload={handleDownload}
                isDeleting={deletingId === attachment.id}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollablePage>
  )
}

export default FileAttachments
