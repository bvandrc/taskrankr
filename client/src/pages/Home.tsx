/**
 * @fileoverview Main task list (tree) page with sorting and filtering
 * capabilities.
 *
 */

import { useMemo, useState } from 'react'
import { LayoutList, Plus, Search } from 'lucide-react'

import { Button } from '@/components/primitives/Button'
import { EmptyState as EmptyStateBase } from '@/components/primitives/EmptyState'
import { Icon } from '@/components/primitives/LucideIcon'
import { SortButton } from '@/components/SortButton'
import { TaskCard } from '@/components/TaskCard'
import { useTaskDialog } from '@/components/TaskForm/TaskFormDialogProvider'
import {
  TaskListPageHeader,
  TaskListPageWrapper,
  TaskListTreeLayout,
} from '@/components/TaskListPage'
import { RANK_FIELDS_COLUMNS } from '@/lib/columns'
import {
  filterAndSortTree,
  getTaskStatuses,
  isEffectivelyHiddenInTree,
  mapById,
  SORT_ORDER_MAP,
} from '@/lib/task-tree-utils'
import { useSettings } from '@/providers/SettingsProvider'
import { useTaskMutations, useTasks } from '@/providers/TasksProvider'
import type { TaskWithSubtasks } from '@/types'
import { type FieldConfig, SortOption, TaskStatus } from '~/shared/schema'

const SortButtons = ({
  sortBy,
  setSortBy,
  fieldConfig,
}: {
  sortBy: SortOption
  setSortBy: (value: SortOption) => void
  fieldConfig: FieldConfig
}) => (
  <div className="flex items-center gap-1 pr-1">
    <SortButton
      label="Date"
      value={SortOption.DATE_CREATED}
      className="min-w-12 max-w-16"
      current={sortBy}
      onSelect={setSortBy}
    />
    {RANK_FIELDS_COLUMNS.map((field) =>
      fieldConfig[field.name].visible ? (
        <SortButton
          key={`${field.name}-sort-btn`}
          label={field.labelShort ?? field.label}
          value={field.name}
          className="w-16"
          current={sortBy}
          onSelect={setSortBy}
        />
      ) : null,
    )}
  </div>
)

const DeleteDemoDataButton = ({ onClick }: { onClick: () => void }) => (
  <div className="mt-12 pt-6 flex justify-center">
    <Button
      variant="ghost"
      size="sm"
      className="text-danger bg-danger/10 hover:text-danger hover:bg-danger/15"
      onClick={onClick}
      data-testid="button-delete-demo-data"
    >
      Delete Demo Data
    </Button>
  </div>
)

const CreateTaskButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    onClick={onClick}
    size="icon"
    className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground z-50 transition-transform active:scale-95 border-0"
    data-testid="button-create-task"
  >
    <Plus className="size-6" />
  </Button>
)

const EmptyState = ({
  search,
  onCreateClick,
}: {
  search: string | undefined
  onCreateClick: () => void
}) => (
  <EmptyStateBase
    icon={
      <Icon
        icon={search ? Search : LayoutList}
        className="size-8 text-muted-foreground"
      />
    }
    title={search ? 'No matching tasks found' : 'Your list is empty'}
    description={
      search
        ? 'Try adjusting your search terms.'
        : 'Start by adding your first task to get organized.'
    }
    action={
      !search && (
        <Button onClick={onCreateClick} variant="secondary" className="mt-4">
          Create First Task
        </Button>
      )
    }
  />
)

const Home = () => {
  const { tasks: allTasks, hasDemoData } = useTasks()
  const { isInitialized, deleteDemoData } = useTaskMutations()
  const { settings, updateSettings } = useSettings()
  const { openCreateDialog } = useTaskDialog()
  const [searchTerm, setSearchTerm] = useState('')

  const sortBy = settings.sortBy
  const setSortBy = (value: SortOption) => updateSettings({ sortBy: value })

  // Build tree from flat list, excluding completed tasks
  // Also extract in-progress and pinned tasks to be hoisted to top
  // Pinned/in-progress subtasks appear both hoisted AND under their parent
  const { taskTree, inProgressTask, pinnedTasks } = useMemo(() => {
    const taskById = mapById(allTasks)
    const activeTasks = allTasks.filter(
      (task) =>
        !isEffectivelyHiddenInTree(task, taskById) &&
        (task.status !== TaskStatus.COMPLETED || task.parentId !== null),
    )

    const hoistedIds = new Set<number>()

    activeTasks.forEach((task) => {
      const { isInProgress, isPinned } = getTaskStatuses(task)
      if (isInProgress || isPinned) {
        hoistedIds.add(task.id)
      }
    })

    const nodes: Record<number, TaskWithSubtasks> = {}
    activeTasks.forEach((task) => {
      nodes[task.id] = { ...task, subtasks: [] }
    })

    const roots: TaskWithSubtasks[] = []
    activeTasks.forEach((task) => {
      if (task.parentId && nodes[task.parentId]) {
        nodes[task.parentId].subtasks.push(nodes[task.id])
      } else if (!task.parentId && !hoistedIds.has(task.id)) {
        roots.push(nodes[task.id])
      }
    })

    let inProgress: TaskWithSubtasks | undefined
    const pinnedList: TaskWithSubtasks[] = []

    for (const id of Array.from(hoistedIds)) {
      const node = nodes[id]
      if (!node) continue
      if (node.status === TaskStatus.IN_PROGRESS) {
        inProgress = node
      } else {
        pinnedList.push(node)
      }
    }

    return {
      taskTree: roots,
      inProgressTask: inProgress,
      pinnedTasks: pinnedList,
    }
  }, [allTasks])

  const displayedTasks = useMemo(() => {
    const sortOrder = SORT_ORDER_MAP[sortBy]
    const sortedInProgress = inProgressTask
      ? filterAndSortTree([inProgressTask], {
          searchTerm,
          fieldSortOrder: sortOrder,
        })
      : []

    const pinnedSort =
      settings.alwaysSortPinnedByPriority && sortBy !== SortOption.PRIORITY
        ? [SortOption.PRIORITY, ...sortOrder]
        : sortOrder
    const sortedPinned = filterAndSortTree(pinnedTasks, {
      searchTerm,
      fieldSortOrder: pinnedSort,
      childFieldSortOrder: pinnedSort !== sortOrder ? sortOrder : undefined,
    })

    const sortedTree = filterAndSortTree(taskTree, {
      searchTerm,
      fieldSortOrder: sortOrder,
    })
    return [...sortedInProgress, ...sortedPinned, ...sortedTree]
  }, [taskTree, inProgressTask, pinnedTasks, searchTerm, sortBy, settings])

  return (
    <TaskListPageWrapper isLoading={!isInitialized} data-testid="home-page">
      <TaskListPageHeader
        title="Home (Open Tasks)"
        showTitle={false}
        ColumnHeaders={
          <SortButtons
            sortBy={sortBy}
            setSortBy={setSortBy}
            fieldConfig={settings.fieldConfig}
          />
        }
        searchVal={searchTerm}
        setSearchVal={setSearchTerm}
      />

      <TaskListTreeLayout>
        {displayedTasks.length === 0 ? (
          <EmptyState
            search={searchTerm}
            onCreateClick={() => openCreateDialog()}
          />
        ) : (
          displayedTasks.map((task) => (
            <TaskCard key={task.clientKey} task={task} />
          ))
        )}

        {hasDemoData && displayedTasks.length > 0 && (
          <DeleteDemoDataButton onClick={deleteDemoData} />
        )}
      </TaskListTreeLayout>

      <CreateTaskButton onClick={() => openCreateDialog()} />
    </TaskListPageWrapper>
  )
}

export default Home
