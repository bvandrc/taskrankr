/**
 * @fileoverview Subtask list with drag-and-drop reordering for the task form
 */

import { useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Link, Plus } from 'lucide-react'
import { useFormContext } from 'react-hook-form'

import { useFormFieldsWithDefaults } from '@/hooks/useFormFieldsWithDefaults'
import {
  getById,
  getDirectSubtasks,
  isEffectivelyHiddenInTree,
  mapById,
  SORT_ORDER_MAP,
  sortTasksByMode,
} from '@/lib/task-tree-utils'
import { cn } from '@/lib/utils'
import { useDraftSession } from '@/providers/DraftSessionProvider'
import { useSettings } from '@/providers/SettingsProvider'
import type { DeleteTaskArgs } from '@/providers/TasksProvider'
import {
  type MutateTask,
  SubtaskSortMode,
  type Task,
  taskSchemaDefaults,
} from '~/shared/schema'
import { CollapsibleCard } from '../../primitives/CollapsibleCard'
import { type Subtask, SubtaskRowItem } from './SubtaskRowItem'
import { SubtasksSettings } from './SubtasksSettings'

const ADD_SUBTASK_BTN_CLASS =
  'flex items-center justify-center p-3 bg-secondary/5 hover:bg-secondary/15 transition-colors text-sm text-foreground hover:text-foreground'

interface SubtasksCardProps {
  task: Task
  onAddSubtask: (parentId: number) => void
  onEditSubtask?: (task: Task) => void
  onDeleteSubtask?: (task: DeleteTaskArgs) => void
  onAssignSubtask?: (task: Task) => void
  disableAddSubtask?: boolean
}

export const SubtasksCard = ({
  task: taskProp,
  onAddSubtask,
  onEditSubtask,
  onDeleteSubtask,
  onAssignSubtask,
  disableAddSubtask = false,
}: SubtasksCardProps) => {
  const { tasksWithDrafts: allTasks } = useDraftSession()
  const { settings } = useSettings()
  const form = useFormContext<MutateTask>()

  const task = getById(allTasks, taskProp.id) ?? taskProp

  const {
    subtaskSortMode: sortMode,
    subtasksShowNumbers: showNumbers,
    subtaskOrder,
    autoHideCompleted,
    inheritCompletionState,
  } = useFormFieldsWithDefaults(form, taskSchemaDefaults)

  const [showHidden, setShowHidden] = useState(false)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const allSubtasks = useMemo(() => {
    const collectDescendants = (
      parentId: number,
      depth: number,
      effectiveSortMode: SubtaskSortMode,
      parentShowNumbers: boolean,
    ): Subtask[] => {
      const unsortedChildren = getDirectSubtasks(allTasks, parentId)
      const sortedChildren = sortTasksByMode(unsortedChildren, {
        sortMode: effectiveSortMode,
        fieldSortOrder: SORT_ORDER_MAP[settings.sortBy],
        manualOrder:
          depth === 0
            ? subtaskOrder
            : (getById(allTasks, parentId)?.subtaskOrder ?? []),
      })

      const result: Subtask[] = []
      for (let i = 0; i < sortedChildren.length; i++) {
        const child = sortedChildren[i]
        result.push({
          ...child,
          depth,
          subtaskIndex:
            parentShowNumbers && effectiveSortMode === SubtaskSortMode.MANUAL
              ? i
              : undefined,
        })
        const childEffectiveSortMode =
          child.subtaskSortMode === SubtaskSortMode.INHERIT
            ? effectiveSortMode
            : child.subtaskSortMode
        result.push(
          ...collectDescendants(
            child.id,
            depth + 1,
            childEffectiveSortMode,
            child.subtasksShowNumbers,
          ),
        )
      }
      return result
    }

    // If the edited task's own sortMode is INHERIT, walk up to the nearest
    // ancestor that has a concrete mode so depth-0 subtasks sort correctly.
    let initialEffectiveSortMode = sortMode
    if (sortMode === SubtaskSortMode.INHERIT) {
      let currentId = task.parentId
      while (currentId != null) {
        const ancestor = getById(allTasks, currentId)
        if (!ancestor) break
        if (ancestor.subtaskSortMode !== SubtaskSortMode.INHERIT) {
          initialEffectiveSortMode = ancestor.subtaskSortMode
          break
        }
        currentId = ancestor.parentId
      }
    }

    return collectDescendants(task.id, 0, initialEffectiveSortMode, showNumbers)
  }, [task, allTasks, sortMode, subtaskOrder, showNumbers, settings.sortBy])

  // Override the edited task's `autoHideCompleted` in the lookup map so the
  // live preview reflects the unsaved form value rather than the persisted one.
  const taskById = useMemo(() => {
    const map = mapById(allTasks)
    const current = map.get(task.id)
    if (current) {
      map.set(task.id, { ...current, autoHideCompleted })
    }
    return map
  }, [allTasks, task.id, autoHideCompleted])

  // Walk in tree order (parent before children) so hidden status propagates
  // transitively — descendants of a hidden parent are also hidden even if the
  // intermediate parent has autoHideCompleted: false.
  const hiddenSubtaskIds = useMemo(
    () =>
      allSubtasks.reduce((set, subtask) => {
        if (
          isEffectivelyHiddenInTree(subtask, taskById) ||
          (subtask.parentId != null && set.has(subtask.parentId))
        )
          set.add(subtask.id)
        return set
      }, new Set<number>()),
    [allSubtasks, taskById],
  )

  const hiddenCount = hiddenSubtaskIds.size

  const visibleSubtasks = useMemo(() => {
    if (showHidden) return allSubtasks
    return allSubtasks.filter((s) => !hiddenSubtaskIds.has(s.id))
  }, [allSubtasks, showHidden, hiddenSubtaskIds])

  const totalCount = allSubtasks.length

  const visibleDirectChildIds = useMemo(
    () => visibleSubtasks.filter((t) => t.depth === 0).map((t) => t.id),
    [visibleSubtasks],
  )

  const allDirectChildIds = useMemo(
    () => allSubtasks.filter((t) => t.depth === 0).map((t) => t.id),
    [allSubtasks],
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = visibleDirectChildIds.indexOf(active.id as number)
      const newIndex = visibleDirectChildIds.indexOf(over.id as number)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedVisible = arrayMove(
          visibleDirectChildIds,
          oldIndex,
          newIndex,
        )
        // Splice the reordered visible IDs back into the full order, leaving
        // hidden siblings pinned to their original positions.
        const visibleSet = new Set(visibleDirectChildIds)
        let i = 0
        const merged = allDirectChildIds.map((id) =>
          visibleSet.has(id) ? reorderedVisible[i++] : id,
        )
        form.setValue('subtaskOrder', merged, { shouldDirty: true })
      }
    }
  }

  const handleSortModeChange = (newMode: SubtaskSortMode) => {
    form.setValue('subtaskSortMode', newMode, { shouldDirty: true })
    // Materialize the current order into the form so dragging works immediately
    // under MANUAL mode. Includes hidden children so they keep their relative
    // position when the order is persisted on Save.
    if (newMode === SubtaskSortMode.MANUAL && allDirectChildIds.length > 0) {
      form.setValue('subtaskOrder', allDirectChildIds, { shouldDirty: true })
    }
  }

  const handleShowNumbersChange = (checked: boolean) =>
    form.setValue('subtasksShowNumbers', checked, { shouldDirty: true })

  const handleAutoHideCompletedChange = (checked: boolean) =>
    form.setValue('autoHideCompleted', checked, { shouldDirty: true })

  const handleInheritCompletionStateChange = (checked: boolean) =>
    form.setValue('inheritCompletionState', checked, { shouldDirty: true })

  return (
    <div
      className="border border-white/10 rounded-lg overflow-hidden"
      data-testid="subtasks-card"
    >
      {totalCount > 0 && (
        <CollapsibleCard
          title={
            <span className="text-sm font-medium">Subtasks ({totalCount})</span>
          }
          defaultOpen
          noCard
          className="bg-secondary/10"
          triggerClassName="p-3 hover:bg-secondary/20 transition-colors"
          contentClassName="mt-0"
          data-testid="button-toggle-subtasks"
        >
          <SubtasksSettings
            sortMode={sortMode}
            showNumbers={showNumbers}
            autoHideCompleted={autoHideCompleted}
            inheritCompletionState={inheritCompletionState}
            showHidden={showHidden}
            hiddenCount={hiddenCount}
            onSortModeChange={handleSortModeChange}
            onShowNumbersChange={handleShowNumbersChange}
            onAutoHideCompletedChange={handleAutoHideCompletedChange}
            onInheritCompletionStateChange={handleInheritCompletionStateChange}
            onShowHiddenChange={setShowHidden}
          />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleDirectChildIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-white/5">
                {visibleSubtasks.map((subtask) => (
                  <SubtaskRowItem
                    key={subtask.clientKey}
                    task={subtask}
                    onEdit={onEditSubtask}
                    onDelete={(t) => onDeleteSubtask?.(t)}
                    sortMode={sortMode}
                    isDragDisabled={false}
                    isHiddenItem={hiddenSubtaskIds.has(subtask.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CollapsibleCard>
      )}
      <div className="flex border-t border-white/5">
        <button
          type="button"
          onClick={() => onAddSubtask(task.id)}
          disabled={disableAddSubtask}
          className={cn(
            ADD_SUBTASK_BTN_CLASS,
            'flex-[4] gap-2 disabled:opacity-40 disabled:cursor-not-allowed',
          )}
          data-testid="button-add-subtask"
        >
          <Plus className="size-4" />
          Add Subtask
        </button>
        <button
          type="button"
          onClick={() => onAssignSubtask?.(task)}
          className={cn(
            ADD_SUBTASK_BTN_CLASS,
            'flex-1 gap-1.5 border-l border-white/5',
          )}
          data-testid="button-assign-subtask"
        >
          <Link className="size-4" />
          Assign
        </button>
      </div>
    </div>
  )
}
