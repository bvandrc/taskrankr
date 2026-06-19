/**
 * @fileoverview Dialog component for changing task status (i.e. open,
 * in_progress, pinned, completed) as well as updating time spent on tasks,
 * deleting tasks. Adapts available actions based on current task status.
 */

import { useEffect, useState } from 'react'
import { Clock, type LucideIcon, Pin, PinOff, StopCircle } from 'lucide-react'

import { getTaskStatuses } from '@/lib/task-tree-utils'
import { cn } from '@/lib/utils'
import { useSettings } from '@/providers/SettingsProvider'
import { TaskStatus } from '~/shared/schema'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { Button } from './primitives/Button'
import { TimeInput } from './primitives/forms/TimeInput'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './primitives/overlays/AlertDialog'
import { SubtaskBlockedTooltip } from './SubtaskBlockedTooltip'

const DeleteButton = ({
  taskName,
  onConfirm,
}: {
  taskName: string
  onConfirm: () => void
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-danger hover:text-danger hover:bg-danger/10 gap-2 h-8"
        onClick={() => {
          setTimeout(() => setShowDeleteConfirm(true), 100)
        }}
        data-testid="button-delete-task"
      >
        <span className="text-xs font-medium">Delete Permanently</span>
      </Button>
      <ConfirmDeleteDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        taskName={taskName}
        onConfirm={() => {
          onConfirm()
          setShowDeleteConfirm(false)
        }}
      />
    </>
  )
}

interface ChangeStatusButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  colorClass?: string
  'data-testid': string
}

const ChangeStatusButton = ({
  icon: Icon,
  label,
  onClick,
  colorClass = 'border-slate-400/50 text-slate-400 hover:bg-slate-500/10',
  'data-testid': testId,
}: ChangeStatusButtonProps) => (
  <Button
    onClick={onClick}
    variant="outline"
    className={cn('w-full h-11 text-base font-semibold gap-2', colorClass)}
    data-testid={testId}
  >
    <Icon className="size-4" />
    {label}
  </Button>
)

interface ChangeStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskName: string
  status: TaskStatus
  timeSpent: number
  subtaskTimeMs?: number
  hasIncompleteSubtasks?: boolean
  onSetStatus: (status: TaskStatus) => void
  onUpdateTime: (timeMs: number) => void
  onDelete: () => void
}

export const ChangeStatusDialog = ({
  open,
  onOpenChange,
  taskName,
  status,
  timeSpent: initialTimeSpent,
  subtaskTimeMs = 0,
  hasIncompleteSubtasks,
  onSetStatus,
  onUpdateTime,
  onDelete,
}: ChangeStatusDialogProps) => {
  const { isCompleted, isInProgress, isPinned } = getTaskStatuses({ status })

  const {
    settings: {
      enableInProgressStatus: showInProgressOption,
      fieldConfig: {
        timeSpent: { visible: showTimeSpentInput, required: timeSpentRequired },
      },
    },
  } = useSettings()

  const [timeSpent, setTimeSpent] = useState(initialTimeSpent)

  useEffect(() => {
    if (open) {
      setTimeSpent(initialTimeSpent)
    }
  }, [open, initialTimeSpent])

  const timeInputDisabled = !!hasIncompleteSubtasks

  const handleTimeBlur = () => {
    const clamped = Math.max(timeSpent, subtaskTimeMs)
    if (clamped !== timeSpent) setTimeSpent(clamped)
    const ownTime = clamped - subtaskTimeMs
    const initialOwnTime = initialTimeSpent - subtaskTimeMs
    if (ownTime !== initialOwnTime) {
      onUpdateTime(ownTime)
    }
  }

  const needsTimeSpent = !isCompleted && timeSpentRequired && timeSpent <= 0
  const isCompleteActionDisabled =
    needsTimeSpent || (!isCompleted && hasIncompleteSubtasks)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="bg-card border-white/10 pt-10"
        data-testid="change-status-dialog"
      >
        <AlertDialogCloseButton
          onClose={() => onOpenChange(false)}
          data-testid="button-close-status-dialog"
        />

        <AlertDialogHeader>
          <AlertDialogTitle>
            {isCompleted ? 'Restore Task?' : 'Task Status'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isCompleted
              ? `Move "${taskName}" back to your active task list.`
              : `Choose an action for "${taskName}"`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <div className="flex flex-col gap-3 w-full">
            {!isCompleted && (
              <>
                {showInProgressOption &&
                  (isInProgress ? (
                    <ChangeStatusButton
                      icon={StopCircle}
                      label="Stop Progress"
                      onClick={() => onSetStatus(TaskStatus.PINNED)}
                      data-testid="button-stop-progress"
                    />
                  ) : (
                    <ChangeStatusButton
                      icon={Clock}
                      label="In Progress"
                      onClick={() => onSetStatus(TaskStatus.IN_PROGRESS)}
                      data-testid="button-start-progress"
                      colorClass="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                    />
                  ))}
                {isInProgress || isPinned ? (
                  <ChangeStatusButton
                    icon={PinOff}
                    label="Unpin"
                    onClick={() => onSetStatus(TaskStatus.OPEN)}
                    data-testid="button-unpin"
                  />
                ) : (
                  <ChangeStatusButton
                    icon={Pin}
                    label="Pin to Top"
                    onClick={() => onSetStatus(TaskStatus.PINNED)}
                    data-testid="button-pin"
                  />
                )}
              </>
            )}

            {/** Complete/ Restore to Open button */}
            <SubtaskBlockedTooltip
              blocked={!isCompleted && !!hasIncompleteSubtasks}
            >
              <AlertDialogAction
                onClick={() =>
                  onSetStatus(
                    isCompleted ? TaskStatus.OPEN : TaskStatus.COMPLETED,
                  )
                }
                disabled={isCompleteActionDisabled}
                className={cn(
                  'w-full h-11 text-base font-semibold',
                  isCompleted
                    ? 'bg-primary hover:bg-primary/90 text-white'
                    : isCompleteActionDisabled
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white',
                )}
                data-testid="button-complete-task"
              >
                {isCompleted ? 'Restore Task to Open' : 'Complete Task'}
              </AlertDialogAction>
            </SubtaskBlockedTooltip>

            {/** Time Spent input */}
            {showTimeSpentInput && (
              <SubtaskBlockedTooltip blocked={timeInputDisabled}>
                <div className="flex items-center justify-center gap-3 pt-2 border-t border-white/10">
                  <span className="text-xs text-muted-foreground">
                    Time Spent
                  </span>
                  <TimeInput
                    durationMs={timeSpent}
                    onDurationChange={setTimeSpent}
                    onBlur={handleTimeBlur}
                    disabled={timeInputDisabled}
                    className="w-16 h-8 text-center text-sm bg-secondary/30"
                    data-testid="time-spent-input"
                  />
                </div>
              </SubtaskBlockedTooltip>
            )}

            {needsTimeSpent && (
              <p className="text-xs text-amber-400/70 text-center -mt-1">
                Time spent is required to complete this task
              </p>
            )}

            <div className="flex justify-center gap-2">
              <DeleteButton
                taskName={taskName}
                onConfirm={() => {
                  onOpenChange(false)
                  onDelete()
                }}
              />
            </div>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
