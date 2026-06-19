/**
 * @fileoverview Completed tasks view page.
 */

import { useMemo, useState } from 'react'
import { CheckCircle2, Search } from 'lucide-react'

import { EmptyState as EmptyStateBase } from '@/components/primitives/EmptyState'
import { Icon } from '@/components/primitives/LucideIcon'
import { TaskCard } from '@/components/TaskCard'
import {
  TaskListPageHeader,
  TaskListPageWrapper,
  TaskListTreeLayout,
} from '@/components/TaskListPage'
import { RANK_FIELDS_COLUMNS } from '@/lib/columns'
import {
  filterAndSortTree,
  getDirectSubtasks,
  isAutoHiddenByParent,
  mapById,
} from '@/lib/task-tree-utils'
import { useTaskMutations, useTasks } from '@/providers/TasksProvider'
import type { TaskWithSubtasks } from '@/types'
import { TaskStatus } from '~/shared/schema'

const ColumnHeaders = () => (
  <div className="flex items-center gap-1 shrink-0 justify-end">
    {RANK_FIELDS_COLUMNS.map((field) => (
      <span
        key={`${field.name}-col-header`}
        className="text-[10px] font-medium text-muted-foreground uppercase w-16 text-center"
      >
        {field.labelShort ?? field.label}
      </span>
    ))}
  </div>
)

const EmptyState = ({ search }: { search: string | undefined }) => (
  <EmptyStateBase
    icon={
      <Icon
        icon={search ? Search : CheckCircle2}
        className="size-8 text-muted-foreground"
      />
    }
    title={search ? 'No matching tasks found' : 'No completed tasks yet'}
    description={
      search
        ? 'Try adjusting your search terms.'
        : 'Long-press on any task to mark it as complete.'
    }
  />
)

const Completed = () => {
  const { tasks: allTasks } = useTasks()
  const { isInitialized } = useTaskMutations()
  const [searchTerm, setSearchTerm] = useState('')

  const completedTasks = useMemo(() => {
    const taskById = mapById(allTasks)

    const buildSubtaskTree = (parentId: number): TaskWithSubtasks[] => {
      const children = getDirectSubtasks(allTasks, parentId).filter(
        (t) => !isAutoHiddenByParent(t, taskById),
      )
      return children.map((child) => ({
        ...child,
        subtasks: buildSubtaskTree(child.id),
      }))
    }

    const roots: TaskWithSubtasks[] = allTasks
      .filter(
        (task) =>
          task.status === TaskStatus.COMPLETED &&
          !task.parentId &&
          !isAutoHiddenByParent(task, taskById),
      )
      .map((task) => ({
        ...task,
        subtasks: buildSubtaskTree(task.id),
      }))

    return roots
  }, [allTasks])

  const displayedTasks = useMemo(
    () =>
      filterAndSortTree(completedTasks, {
        searchTerm,
        fieldSortOrder: ['date_completed'],
      }),
    [completedTasks, searchTerm],
  )

  return (
    <TaskListPageWrapper
      isLoading={!isInitialized}
      data-testid="completed-page"
    >
      <TaskListPageHeader
        title="Completed Tasks"
        ColumnHeaders={displayedTasks.length > 0 && <ColumnHeaders />}
        searchVal={searchTerm}
        setSearchVal={setSearchTerm}
      />

      <TaskListTreeLayout>
        {displayedTasks.length === 0 ? (
          <EmptyState search={searchTerm} />
        ) : (
          displayedTasks.map((task) => (
            <TaskCard
              key={task.clientKey}
              task={task}
              showRestore
              showCompletedDate
            />
          ))
        )}
      </TaskListTreeLayout>
    </TaskListPageWrapper>
  )
}

export default Completed
