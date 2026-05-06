/**
 * @fileoverview Dialog to assign an existing parentless task as a subtask
 */

import { useMemo, useState } from 'react'

import {
  collectDescendantIds,
  filterRootTasks,
  getById,
} from '@/lib/task-tree-utils'
import { cn, handleKeyDown } from '@/lib/utils'
import { useTasks } from '@/providers/TasksProvider'
import { type Task, TaskStatus } from '~/shared/schema'
import { Button } from '../../primitives/Button'
import { Checkbox } from '../../primitives/forms/Checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../primitives/overlays/Dialog'
import { SearchInput } from '../../SearchInput'

const LAYER_CLASS = 'z-[200]'

interface AssignSubtaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The real parent task ID, or null when the parent is still a pending draft */
  parentTaskId: number | null
  onConfirm: (task: Pick<Task, 'id' | 'name'>) => void
}

export const AssignSubtaskDialog = ({
  open,
  onOpenChange,
  parentTaskId,
  onConfirm,
}: AssignSubtaskDialogProps) => {
  const { tasks: allTasks } = useTasks()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)

  const orphanTasks = useMemo(() => {
    const descendantIds =
      parentTaskId !== null
        ? collectDescendantIds(allTasks, [parentTaskId], { includeRoots: true })
        : new Set<number>()
    return allTasks.filter(
      (t) =>
        t.parentId === null && // must be an orphan
        (parentTaskId === null || t.id !== parentTaskId) && // must not be the parent task itself
        !descendantIds.has(t.id) && // must not already be a descendant of the parent task
        (showCompleted || t.status !== TaskStatus.COMPLETED), // filter out completed tasks if not showing them
    )
  }, [allTasks, parentTaskId, showCompleted])

  const filteredTasks = useMemo(
    () => filterRootTasks(orphanTasks, search),
    [orphanTasks, search],
  )

  const reset = () => {
    setSelectedId(null)
    setSearch('')
    setShowCompleted(false)
  }

  const handleConfirm = () => {
    if (selectedId == null) return
    const selected = getById(filteredTasks, selectedId)
    if (!selected) return
    onConfirm(selected)
    reset()
    onOpenChange(false)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset()
        }
        onOpenChange(v)
      }}
    >
      <DialogContent
        className={cn('max-w-sm rounded-lg', LAYER_CLASS)}
        overlayClassName={LAYER_CLASS}
        data-testid="assign-subtask-dialog"
      >
        <DialogHeader>
          <DialogTitle>Assign Subtask</DialogTitle>
        </DialogHeader>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter tasks..."
          autoFocus
          data-testid="search-assign-tasks"
        />
        {/** biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is an input*/}
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Checkbox
            checked={showCompleted}
            onCheckedChange={(v) => setShowCompleted(v === true)}
            data-testid="checkbox-show-completed"
          />
          Show Completed
        </label>
        <div
          role="listbox"
          aria-label="Available tasks"
          className="h-64 overflow-y-auto divide-y divide-white/5"
          data-testid="list-orphan-tasks"
        >
          {filteredTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {search.trim()
                ? 'No matching tasks'
                : 'No available tasks to assign'}
            </p>
          ) : (
            filteredTasks.map((t) => (
              <div
                key={t.id}
                role="option"
                aria-selected={selectedId === t.id}
                tabIndex={0}
                onClick={() => setSelectedId(t.id)}
                onKeyDown={handleKeyDown}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-sm transition-colors cursor-pointer',
                  selectedId === t.id
                    ? 'bg-primary/20 text-foreground'
                    : 'hover-elevate text-muted-foreground',
                  t.status === TaskStatus.COMPLETED && 'opacity-50',
                )}
                data-testid={`option-assign-task-${t.id}`}
              >
                {t.name}
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleClose}
            data-testid="button-cancel-assign"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={!selectedId}
            data-testid="button-confirm-assign"
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
