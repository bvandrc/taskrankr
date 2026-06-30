import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EyeOff, GripVertical, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/primitives/Button'
import { getTaskStatuses } from '@/lib/task-tree-utils'
import { cn } from '@/lib/utils'
import type { DeleteTaskArgs } from '@/providers/TasksProvider'
import type { LocalTask } from '@/types'
import { SubtaskSortMode, type Task } from '~/shared/schema'

export type Subtask = LocalTask & { depth: number; subtaskIndex?: number }

export interface SubtaskRowItemProps {
  task: Subtask
  onEdit?: (task: Task) => void
  onDelete: (task: DeleteTaskArgs) => void
  sortMode: SubtaskSortMode
  isDragDisabled?: boolean
  isHiddenItem?: boolean
}

export const SubtaskRowItem = ({
  task,
  onEdit,
  onDelete,
  sortMode,
  isDragDisabled,
  isHiddenItem,
}: SubtaskRowItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isDragDisabled })

  const isManualSortMode = sortMode === SubtaskSortMode.MANUAL

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${12 + task.depth * 16}px`,
  }

  const isDirect = task.depth === 0
  const showDragHandle = isManualSortMode && isDirect
  const { isCompleted } = getTaskStatuses(task)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center justify-between gap-2 px-3 py-1.5 bg-secondary/5 select-none',
        isDragging && 'opacity-50 bg-secondary/20',
      )}
      data-testid={`subtask-row-${task.id}`}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {showDragHandle && (
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing p-1 -ml-2 text-muted-foreground"
            {...attributes}
            {...listeners}
            data-testid={`drag-handle-${task.id}`}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        {task.depth > 0 && (
          <span
            aria-hidden="true"
            className="text-muted-foreground/50 text-xs leading-none select-none before:content-['└']"
          />
        )}
        <span
          className={cn(
            'text-sm wrap-break-word',
            isCompleted && 'line-through text-muted-foreground',
          )}
          data-testid={`subtask-name-${task.id}`}
        >
          {task.subtaskIndex !== undefined && (
            <span className="text-muted-foreground mr-1">
              {task.subtaskIndex + 1}.
            </span>
          )}
          {task.name}
        </span>
        {isHiddenItem && (
          <EyeOff className="size-3 text-muted-foreground/50 shrink-0 ml-1" />
        )}
      </div>
      <div className="flex items-center gap-1">
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onEdit(task)}
            data-testid={`button-edit-subtask-${task.id}`}
          >
            <Pencil className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDelete(task)}
          data-testid={`button-delete-subtask-${task.id}`}
        >
          <Trash2 className="size-4 text-danger" />
        </Button>
      </div>
    </div>
  )
}
