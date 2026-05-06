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
import { filterAndSortTree, getDirectSubtasks } from '@/lib/task-tree-utils'
import { useTaskMutations, useTasks } from '@/providers/TasksProvider'
import type { TaskWithSubtasks } from '@/types'
import { TaskStatus } from '~/shared/schema'
import { isEffectivelyHiddenInTree, mapById } from '~/shared/utils/task-utils'

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
  const [search, setSearch] = useState('')

  const completedTasks = useMemo(() => {
    const taskById = mapById(allTasks)

    const buildSubtaskTree = (parentId: number): TaskWithSubtasks[] => {
      const children = getDirectSubtasks(allTasks, parentId).filter(
        (t) => !isEffectivelyHiddenInTree(t, taskById),
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
          !isEffectivelyHiddenInTree(task, taskById),
      )
      .map((task) => ({
        ...task,
        subtasks: buildSubtaskTree(task.id),
      }))

    return roots
  }, [allTasks])

  const displayedTasks = useMemo(
    () => filterAndSortTree(completedTasks, search, ['date_completed']),
    [completedTasks, search],
  )

  return (
    <TaskListPageWrapper isLoading={!isInitialized}>
      <TaskListPageHeader
        title="Completed Tasks"
        ColumnHeaders={displayedTasks.length > 0 && <ColumnHeaders />}
        searchVal={search}
        setSearchVal={setSearch}
      />

      <TaskListTreeLayout>
        {displayedTasks.length === 0 ? (
          <EmptyState search={search} />
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
