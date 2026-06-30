/**
 * @fileoverview Task display card with status indicators, expandable subtasks,
 * and interactions (single click and long press).
 */

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Pin } from 'lucide-react'

import { useExpandedTasks } from '@/hooks/useExpandedTasks'
import { RANK_FIELDS_COLUMNS } from '@/lib/columns'
import { STANDARD_DATE_FORMAT } from '@/lib/constants'
import { getRankFieldStyle } from '@/lib/rank-field-styles'
import { getHasIncomplete, getTaskStatuses } from '@/lib/task-tree-utils'
import { cn } from '@/lib/utils'
import { useSettings } from '@/providers/SettingsProvider'
import { useTaskMutations } from '@/providers/TasksProvider'
import type { TaskWithSubtasks } from '@/types'
import {
  type FieldConfig,
  Priority,
  type RankField,
  SubtaskSortMode,
  type Task,
  type TaskStatus,
} from '~/shared/schema'
import { ChangeStatusDialog } from './ChangeStatusDialog'
import { Badge } from './primitives/Badge'
import { Icon } from './primitives/LucideIcon'
import { useTaskDialog } from './TaskForm/TaskFormDialogProvider'

const Title = ({
  name,
  isCompleted,
  numberIndex,
}: {
  name: string
  isCompleted: boolean
  numberIndex: number | undefined
}) => (
  <h3
    className={cn(
      'font-semibold text-base wrap-break-word',
      isCompleted ? 'text-muted-foreground line-through' : 'text-foreground',
    )}
    data-testid="task-title"
  >
    {numberIndex !== undefined && (
      <span className="text-muted-foreground mr-1">{numberIndex + 1}.</span>
    )}
    {name}
  </h3>
)

const TaskBadge = ({
  value,
  className,
  muted,
}: {
  value: string
  className: string
  muted?: boolean
}) => (
  <Badge
    variant="outline"
    className={cn(
      'px-1 py-0 border text-[8px] font-bold uppercase w-16 justify-center shrink-0',
      muted
        ? 'text-muted-foreground/50 bg-transparent border-muted/30'
        : className,
    )}
    data-testid={`badge-${value}`}
  >
    {value}
  </Badge>
)

const InProgressBadge = ({
  setShowConfirm,
}: {
  setShowConfirm: (show: boolean) => void
}) => (
  // biome-ignore lint/a11y/noStaticElementInteractions: TODO: resolve
  // biome-ignore lint/a11y/useKeyWithClickEvents: TODO: resolve
  <div
    onClick={(e) => {
      e.stopPropagation()
      setShowConfirm(true)
    }}
    className="cursor-pointer"
  >
    <TaskBadge
      value="In Progress"
      className="text-blue-400 bg-blue-400/10 border-blue-400/20"
    />
  </div>
)

const PinIcon = ({
  setShowConfirm,
}: {
  setShowConfirm: (show: boolean) => void
}) => (
  <Pin
    className="size-4 text-slate-400 shrink-0 rotate-45 cursor-pointer"
    data-testid="icon-pinned"
    onClick={(e) => {
      e.stopPropagation()
      setShowConfirm(true)
    }}
  />
)

const RankBadges = ({
  task,
  fieldConfig,
  isCompleted,
}: {
  task: Pick<Task, RankField>
  fieldConfig: FieldConfig
  isCompleted: boolean
}) => (
  <div className="flex items-center gap-1 justify-end">
    {RANK_FIELDS_COLUMNS.map(({ name: field }) => {
      if (!fieldConfig[field].visible) return null
      const value = task[field]
      return (
        <TaskBadge
          key={field}
          value={value ?? ''}
          className={getRankFieldStyle(field, value, 'opacity-0')}
          muted={isCompleted}
        />
      )
    })}
  </div>
)

const DueText = ({
  schedule,
  priority,
}: Pick<Task, 'schedule' | 'priority'>) => {
  const due = schedule?.dueAt
  if (!due) return null
  const isOverdue = due < new Date()

  const textColorClass = (() => {
    if (isOverdue || priority === Priority.HIGHEST)
      return 'text-red-700 font-bold'
    if (priority === Priority.HIGH) return 'text-red-400'
    if (priority === Priority.MEDIUM) return 'text-yellow-400'
    return 'text-muted-foreground text-[12px]'
  })()

  return (
    <span className={cn('text-[12px]', textColorClass)} data-testid="badge-due">
      Due {format(due, 'MMM d')}
    </span>
  )
}

const CollapseCaret = ({
  taskId,
  isExpanded,
  toggleExpanded,
}: {
  taskId: number
  isExpanded: boolean
  toggleExpanded: (taskId: number) => void
}) => (
  <button
    onClick={(e) => {
      e.stopPropagation()
      toggleExpanded(taskId)
    }}
    className="group/expand flex items-center justify-center w-full rounded-md hover:bg-white/10 transition-colors cursor-pointer"
    type="button"
    data-testid={`button-${isExpanded ? 'collapse' : 'expand'}-${taskId}`}
  >
    <Icon
      icon={isExpanded ? ChevronDown : ChevronRight}
      className="w-3.5 h-3.5 text-muted-foreground"
    />
  </button>
)

interface TaskCardProps {
  task: TaskWithSubtasks
  level?: number
  showRestore?: boolean
  showCompletedDate?: boolean
  numberIndex?: number
}

export const TaskCard = ({
  task,
  level = 0,
  showRestore = false,
  showCompletedDate = false,
  numberIndex,
}: TaskCardProps) => {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isHolding, setIsHolding] = useState(false)
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
  const holdStartY = useRef<number | null>(null)
  const SCROLL_THRESHOLD = 10

  const { setTaskStatus, deleteTask } = useTaskMutations()
  const { settings } = useSettings()
  const { openEditDialog } = useTaskDialog()
  const { isExpanded: checkExpanded, toggleExpanded } = useExpandedTasks()

  const hasSubtasks = task.subtasks.length > 0
  const isExpanded = checkExpanded(task.id)
  const { isInProgress, isPinned, isCompleted } = getTaskStatuses(task)
  const isNestedWithStatus = level > 0 && (isInProgress || isPinned)
  const isNestedCompleted = level > 0 && isCompleted

  const startHold = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return

    holdStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY

    setIsHolding(true)
    const duration = 800

    holdTimerRef.current = setTimeout(() => {
      setShowConfirm(true)
      setIsHolding(false)
    }, duration)
  }

  const cancelHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdStartY.current = null
    setIsHolding(false)
  }

  const checkMoveThreshold = (clientY: number) => {
    if (holdStartY.current === null) return
    if (Math.abs(clientY - holdStartY.current) > SCROLL_THRESHOLD) cancelHold()
  }

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [])

  const handleSetStatus = (status: TaskStatus) => {
    setTaskStatus(task.id, status)
    setShowConfirm(false)
  }

  return (
    <div
      className="group relative"
      data-testid={`task-card-${task.id}`}
      data-tier={`${level}`}
      data-status={task.status}
    >
      <motion.div
        {...(level === 0
          ? {
              layout: true,
              initial: { opacity: 0, y: 10 },
              animate: { opacity: 1, y: 0 },
            }
          : { initial: false })}
        className={cn(
          'relative flex items-center gap-2 pr-2 pl-1 py-1.5 rounded-lg border transition-all duration-200 select-none cursor-pointer',
          isNestedWithStatus
            ? 'border-transparent hover:bg-white/2 hover:border-white/5'
            : isInProgress
              ? 'border-blue-500/30 bg-blue-500/5'
              : isPinned
                ? 'border-slate-400/30 bg-slate-500/5'
                : 'border-transparent hover:bg-white/2 hover:border-white/5',
          isHolding && 'bg-white/5 scale-[0.99] transition-transform',
        )}
        style={{ marginLeft: `${level * 16}px` }}
        onClick={() => openEditDialog(task)}
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchMove={(e) => checkMoveThreshold(e.touches[0].clientY)}
        onTouchEnd={cancelHold}
        onMouseMove={(e) => checkMoveThreshold(e.clientY)}
      >
        <div className="w-5 flex justify-center shrink-0 self-stretch">
          {hasSubtasks ? (
            <CollapseCaret
              taskId={task.id}
              isExpanded={isExpanded}
              toggleExpanded={toggleExpanded}
            />
          ) : (
            <div className="w-3.5" />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-4">
          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
            <Title
              name={task.name}
              isCompleted={isNestedCompleted}
              numberIndex={numberIndex}
            />
            {isInProgress && (
              <InProgressBadge setShowConfirm={setShowConfirm} />
            )}
            {isPinned && <PinIcon setShowConfirm={setShowConfirm} />}
            <DueText schedule={task.schedule} priority={task.priority} />
          </div>
          <div className="flex flex-col items-end shrink-0 md:w-67 md:pr-0">
            <RankBadges
              task={task}
              fieldConfig={settings.fieldConfig}
              isCompleted={isNestedCompleted}
            />
            {showCompletedDate && task.completedAt && (
              <span className="text-xs text-muted-foreground mt-0.5">
                Completed:{' '}
                {new Date(task.completedAt).toLocaleDateString(
                  'en-US',
                  STANDARD_DATE_FORMAT,
                )}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isExpanded && hasSubtasks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                height: { duration: 0.2 },
                opacity: { duration: 0.15, delay: 0.05 },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                opacity: { duration: 0.1 },
                height: { duration: 0.15, delay: 0.05 },
              },
            }}
            className="overflow-hidden will-change-[height]"
          >
            <div className="relative">
              <div
                className="absolute left-6.5 top-0 bottom-3 w-px bg-white/5"
                style={{ marginLeft: `${level * 16}px` }}
              />
              {task.subtasks.map((subtask, index) => (
                <TaskCard
                  key={subtask.clientKey}
                  task={subtask}
                  level={level + 1}
                  showRestore={showRestore}
                  showCompletedDate={showCompletedDate}
                  numberIndex={
                    task.subtaskSortMode === SubtaskSortMode.MANUAL
                      ? index
                      : undefined
                  }
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChangeStatusDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        taskName={task.name}
        status={task.status}
        hasIncompleteSubtasks={getHasIncomplete(task.subtasks)}
        onSetStatus={handleSetStatus}
        onDelete={() => deleteTask(task.id)}
      />
    </div>
  )
}
