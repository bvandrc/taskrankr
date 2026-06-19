/**
 * @fileoverview Context provider for task create/edit dialog with
 * desktop/mobile variants. Builds a navigation stack of tasks (real or draft)
 * being edited. All in-flight subtask additions and assignments live in
 * TasksProvider's draft session and are committed atomically on Submit
 * or discarded on Cancel.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { without } from 'es-toolkit'
import { AnimatePresence, motion } from 'framer-motion'
import type { EmptyObject } from 'type-fest'

import { useIsMobile } from '@/hooks/useMobile'
import { getById } from '@/lib/task-tree-utils'
import {
  DraftSessionProvider,
  useDraftSession,
  useDraftSessionMutations,
} from '@/providers/DraftSessionProvider'
import {
  type CreateTaskContent,
  type DeleteTaskArgs,
  type MutateTaskContent,
  useTaskMutations,
} from '@/providers/TasksProvider'
import type { CreateTask, Task } from '~/shared/schema'
import { SubtaskSortMode, TaskStatus } from '~/shared/schema'
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog'
import { ConfirmAlertDialog } from '../primitives/overlays/ConfirmAlertDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../primitives/overlays/Dialog'
import { AssignSubtaskDialog } from '../TaskForm/SubtasksCard/AssignSubtaskDialog'
import { SubtaskActionDialog } from '../TaskForm/SubtasksCard/SubtaskActionDialog'
import { TaskForm, type TaskFormProps } from '../TaskForm/TaskForm'
import { TaskFormCancelConfirmDialog } from '../TaskForm/TaskFormCancelConfirmDialog'

interface TaskFormDialogContextType {
  openCreateDialog: (parentId?: number) => void
  openEditDialog: (task: Task) => void
  closeDialog: () => void
}

const TaskFormDialogContext = createContext<
  TaskFormDialogContextType | undefined
>(undefined)

export const useTaskDialog = () => {
  const context = useContext(TaskFormDialogContext)
  if (!context)
    throw new Error('useTaskDialog must be used within a TaskDialogProvider')
  return context
}

interface NavEntry {
  /** ID of task being edited at this nav level. Null = fresh-create (no draft yet). */
  taskId: number | null
  /** True if this entry was created via "Add Subtask" during the session.
   *  Backing out (Cancel) from such an entry deletes the draft.
   *  Note: not used for dialogMode/activeTask derivation — those rely on
   *  draftTaskIds membership directly. */
  isNewDraft: boolean
}

export enum TaskFormDialogMode {
  CREATE = 'create',
  EDIT = 'edit',
}

interface TaskFormDialogProps
  extends Pick<
    TaskFormProps,
    | 'onSubmit'
    | 'onAddSubtask'
    | 'onEditSubtask'
    | 'onDeleteSubtask'
    | 'onAssignSubtask'
    | 'isDraft'
    | 'showHidden'
    | 'onShowHiddenChange'
  > {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  mode: TaskFormDialogMode
  parentId?: number
  activeTask?: Task
  formKey: string | number
  onClose: () => void
}

const DesktopDialog = ({
  isOpen,
  setIsOpen,
  mode,
  parentId,
  activeTask,
  formKey,
  onClose,
  ...taskFormArgs
}: TaskFormDialogProps) => (
  <div data-testid="task-form-dialog-desktop">
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
        else setIsOpen(true)
      }}
    >
      <DialogContent
        className="w-full max-w-[600px] max-h-[calc(100vh-2.5rem)] overflow-hidden bg-card border-white/10 p-6 shadow-2xl rounded-xl flex flex-col [&>form]:min-h-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <div className="flex-1">
            <DialogTitle className="text-2xl font-display tracking-tight">
              {mode === TaskFormDialogMode.CREATE
                ? parentId
                  ? 'New Subtask'
                  : 'New Task'
                : 'Edit Task'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {mode === TaskFormDialogMode.CREATE
                ? 'Add a new item to your list.'
                : 'Update task details and properties.'}
            </DialogDescription>
          </div>
        </DialogHeader>
        <TaskForm
          {...taskFormArgs}
          key={formKey}
          initialData={activeTask}
          parentId={parentId}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  </div>
)

const MobileDialog = ({
  isOpen,
  activeTask,
  parentId,
  formKey,
  onClose,
  ...taskFormArgs
}: Omit<TaskFormDialogProps, 'setIsOpen' | 'mode'>) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden"
        data-testid="task-form-dialog-mobile"
      >
        <TaskForm
          {...taskFormArgs}
          key={formKey}
          initialData={activeTask}
          parentId={parentId}
          onCancel={onClose}
        />
      </motion.div>
    )}
  </AnimatePresence>
)

const TaskFormDialogProviderInner = ({
  children,
}: React.PropsWithChildren<EmptyObject>) => {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const [navStack, setNavStack] = useState<NavEntry[]>([])
  const [freshCreateParentId, setFreshCreateParentId] = useState<number | null>(
    null,
  )
  const [showHiddenByTaskId, setShowHiddenByTaskId] = useState<
    Map<number, boolean>
  >(new Map())
  const [subtaskToDelete, setSubtaskToDelete] = useState<DeleteTaskArgs | null>(
    null,
  )
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showSaveOpenSubtasksConfirm, setShowSaveOpenSubtasksConfirm] =
    useState(false)
  const [pendingSaveFormData, setPendingSaveFormData] =
    useState<MutateTaskContent | null>(null)
  /** When non-null, AssignSubtaskDialog is open and the picked task should be
   *  assigned under this parent (real or draft). */
  const [assignTargetParentId, setAssignTargetParentId] = useState<
    number | null
  >(null)

  const { createTask, subscribeToIdReplacement } = useTaskMutations()
  const {
    tasksWithDrafts,
    hasDraftSession,
    draftTaskIds,
    draftAssignmentCount,
  } = useDraftSession()
  const {
    updateTask,
    deleteTask,
    createDraftTask,
    assignDraftSubtask,
    commitDraftSession,
    discardDraftSession,
  } = useDraftSessionMutations()

  // Keep nav stack ids in sync when temp ids get replaced after server sync.
  useEffect(() => {
    return subscribeToIdReplacement((tempId, realId) => {
      setNavStack((prev) =>
        prev.map((e) => (e.taskId === tempId ? { ...e, taskId: realId } : e)),
      )
    })
  }, [subscribeToIdReplacement])

  /** Draft subtasks (excluding the root draft) that are not completed. */
  const incompleteDraftSubtasks = useMemo(() => {
    const rootId = navStack[0]?.taskId
    return [...draftTaskIds]
      .filter((id) => id !== rootId)
      .filter((id) => {
        const task = getById(tasksWithDrafts, id)
        return task != null && task.status !== TaskStatus.COMPLETED
      })
  }, [draftTaskIds, tasksWithDrafts, navStack])

  const currentEntry: NavEntry | null = navStack.at(-1) ?? null
  const rootEntry: NavEntry | null = navStack[0] ?? null
  const currentTask =
    currentEntry?.taskId != null
      ? getById(tasksWithDrafts, currentEntry.taskId)
      : undefined
  const isDraftId = (id: number) => draftTaskIds.has(id)

  // The form's "parentId" prop drives the parent breadcrumb chain.
  const dialogParentId =
    currentEntry?.taskId === null
      ? (freshCreateParentId ?? undefined)
      : (currentTask?.parentId ?? undefined)

  // Submit button label: 'Create' for fresh-create or any draft entry (root
  // promoted via Add Subtask, or nested draft just added). Real entities show
  // 'Edit'.
  const dialogMode: TaskFormDialogMode =
    !currentEntry ||
    currentEntry.taskId === null ||
    isDraftId(currentEntry.taskId)
      ? TaskFormDialogMode.CREATE
      : TaskFormDialogMode.EDIT

  // Pass undefined initialData for fresh-create so the form starts blank;
  // otherwise show the looked-up task (real or draft).
  const activeTask = currentEntry?.taskId != null ? currentTask : undefined

  // Count for the cancel-confirm dialog. Excludes the root entry if it's a
  // draft (the root represents the entity being created, not a "subtask").
  const rootIsDraft =
    rootEntry?.taskId != null && draftTaskIds.has(rootEntry.taskId)
  const pendingSubtaskCount =
    draftTaskIds.size - (rootIsDraft ? 1 : 0) + draftAssignmentCount

  const formKey: string | number = !currentEntry
    ? 'empty'
    : currentEntry.taskId === null
      ? `new-${freshCreateParentId ?? 'root'}`
      : currentEntry.taskId

  // Clear nav state shortly after the dialog closes so the close animation
  // can play out without the form blanking. If the user reopens before the
  // timer fires, the effect cleanup cancels it.
  useEffect(() => {
    if (isOpen) return
    const t = setTimeout(() => {
      setNavStack([])
      setFreshCreateParentId(null)
    }, 300)
    return () => clearTimeout(t)
  }, [isOpen])

  const resetAndClose = () => {
    discardDraftSession()
    setShowCancelConfirm(false)
    setShowHiddenByTaskId(new Map())
    setIsOpen(false)
  }

  const openCreateDialog = (pid?: number) => {
    discardDraftSession()
    setFreshCreateParentId(pid ?? null)
    setNavStack([{ taskId: null, isNewDraft: false }])
    setIsOpen(true)
  }

  const openEditDialog = (task: Task) => {
    discardDraftSession()
    setFreshCreateParentId(null)
    setNavStack([{ taskId: task.id, isNewDraft: false }])
    setIsOpen(true)
  }

  const closeDialog = () => {
    if (navStack.length > 1) {
      const top = navStack.at(-1)
      // Backing out of a freshly-added subtask drops the draft.
      if (top?.isNewDraft && top.taskId != null && isDraftId(top.taskId)) {
        deleteTask(top.taskId)
      }
      setNavStack((prev) => prev.slice(0, -1))
      return
    }
    if (pendingSubtaskCount > 0) {
      setShowCancelConfirm(true)
      return
    }
    resetAndClose()
  }

  /** Promote a fresh-create entry to a draft root using the current form
   *  values. Returns the new draft id and updates the nav stack. Only ever
   *  called when navStack has exactly one entry whose taskId is null. */
  const promoteFreshToDraft = (data: MutateTaskContent): number => {
    const draft = createDraftTask({
      ...data,
      parentId: freshCreateParentId ?? undefined,
    } as CreateTaskContent)
    setNavStack([{ taskId: draft.id, isNewDraft: false }])
    return draft.id
  }

  /** Returns the parent id (real or draft) the next child/assignee should
   *  attach to, promoting the root to a draft if needed. Persists current
   *  form edits to draft roots; leaves real entities untouched so a Cancel
   *  produces zero backend writes. */
  const ensureMutableParent = (formData: MutateTaskContent): number | null => {
    const top = navStack.at(-1)
    if (!top) return null
    if (top.taskId === null) return promoteFreshToDraft(formData)
    if (isDraftId(top.taskId)) {
      updateTask(top.taskId, formData)
      return top.taskId
    }
    return top.taskId
  }

  const handleSubmit = async (data: MutateTaskContent) => {
    const top = navStack.at(-1)
    if (!top) return
    const isRoot = navStack.length === 1

    // Guard: when saving a completed task that has newly-added incomplete
    // subtasks, warn the user that the parent will be re-opened. Skip this
    // branch when re-called from the dialog's onConfirm — at that point
    // pendingSaveFormData is already set, signalling the user has confirmed.
    if (
      isRoot &&
      pendingSaveFormData === null &&
      data.status === TaskStatus.COMPLETED &&
      incompleteDraftSubtasks.length > 0
    ) {
      setPendingSaveFormData(data)
      setShowSaveOpenSubtasksConfirm(true)
      return
    }

    setShowSaveOpenSubtasksConfirm(false)
    setPendingSaveFormData(null)

    try {
      if (top.taskId === null) {
        // Fresh create with no draft: just create directly.
        await createTask({
          ...data,
          parentId: freshCreateParentId ?? undefined,
        } as CreateTask)
        // Defensive: any stray drafts get committed (shouldn't exist here).
        if (hasDraftSession) await commitDraftSession()
        resetAndClose()
        return
      }

      // Save form data to current entity. updateTask routes drafts internally.
      // If the user confirmed saving a completed task that has incomplete draft
      // subtasks, force the parent back to OPEN so the intent ("saving will
      // re-open this task") is actually applied.
      const effectiveData =
        isRoot &&
        data.status === TaskStatus.COMPLETED &&
        incompleteDraftSubtasks.length > 0
          ? { ...data, status: TaskStatus.OPEN }
          : data
      await updateTask(top.taskId, effectiveData)

      if (isRoot) {
        if (hasDraftSession) await commitDraftSession()
        resetAndClose()
      } else {
        // Returning from a nested form: pop back to the parent.
        setNavStack((prev) => prev.slice(0, -1))
      }
    } catch {
      // Mutator already surfaced a toast; keep dialog open so user can retry.
    }
  }

  const handleAddSubtask = (_pid: number, formData?: MutateTaskContent) => {
    if (!formData) return
    const parentForChildId = ensureMutableParent(formData)
    if (parentForChildId === null) return
    const child = createDraftTask({
      name: '',
      parentId: parentForChildId,
    } as CreateTaskContent)
    setNavStack((prev) => [...prev, { taskId: child.id, isNewDraft: true }])
  }

  const handleEditSubtask = (task: Task) => {
    setNavStack((prev) => [...prev, { taskId: task.id, isNewDraft: false }])
  }

  const handleAssignSubtask = (_task: Task, formData?: MutateTaskContent) => {
    if (!formData) return
    const parentId = ensureMutableParent(formData)
    if (parentId === null) return
    setAssignTargetParentId(parentId)
  }

  const handleAssignConfirm = ({
    id: selectedId,
  }: Pick<Task, 'id' | 'name'>) => {
    if (assignTargetParentId === null) return
    if (isDraftId(assignTargetParentId)) {
      assignDraftSubtask(selectedId, assignTargetParentId)
    } else {
      // Real parent (editing an existing task): immediate update.
      updateTask(selectedId, { parentId: assignTargetParentId })
      const parent = getById(tasksWithDrafts, assignTargetParentId)
      if (parent && parent.subtaskSortMode === SubtaskSortMode.MANUAL) {
        updateTask(assignTargetParentId, {
          subtaskOrder: [...parent.subtaskOrder, selectedId],
        })
      }
    }
    setAssignTargetParentId(null)
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const activeTaskId = activeTask?.id ?? null

  const taskFormDialogProps: Omit<TaskFormDialogProps, 'setIsOpen' | 'mode'> = {
    isOpen,
    activeTask,
    parentId: dialogParentId,
    formKey,
    onClose: closeDialog,
    onSubmit: handleSubmit,
    onAddSubtask: handleAddSubtask,
    onEditSubtask: handleEditSubtask,
    onDeleteSubtask: setSubtaskToDelete,
    onAssignSubtask: handleAssignSubtask,
    isDraft: activeTask != null && draftTaskIds.has(activeTask.id),
    showHidden:
      activeTaskId != null
        ? (showHiddenByTaskId.get(activeTaskId) ?? false)
        : false,
    onShowHiddenChange: (show: boolean) => {
      if (activeTaskId != null) {
        setShowHiddenByTaskId((prev) => new Map(prev).set(activeTaskId, show))
      }
    },
  }

  return (
    <TaskFormDialogContext.Provider
      value={{ openCreateDialog, openEditDialog, closeDialog }}
    >
      {children}

      {isMobile ? (
        <MobileDialog {...taskFormDialogProps} />
      ) : (
        <DesktopDialog
          {...taskFormDialogProps}
          setIsOpen={setIsOpen}
          mode={dialogMode}
        />
      )}

      <SubtaskActionDialog
        open={!!subtaskToDelete && !showDeleteConfirm}
        onOpenChange={(open) => !open && setSubtaskToDelete(null)}
        taskName={subtaskToDelete?.name ?? ''}
        onDelete={() => setShowDeleteConfirm(true)}
        onRemoveAsSubtask={() => {
          if (subtaskToDelete) {
            updateTask(subtaskToDelete.id, {
              parentId: null,
            })
            const top = currentEntry?.taskId
            if (top != null) {
              const parent = getById(tasksWithDrafts, top)
              if (parent) {
                updateTask(top, {
                  subtaskOrder: without(
                    parent.subtaskOrder,
                    subtaskToDelete.id,
                  ),
                })
              }
            }
            setSubtaskToDelete(null)
          }
        }}
      />

      <ConfirmDeleteDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteConfirm(false)
            setSubtaskToDelete(null)
          }
        }}
        taskName={subtaskToDelete?.name ?? ''}
        onConfirm={() => {
          if (subtaskToDelete) {
            deleteTask(subtaskToDelete.id)
            setShowDeleteConfirm(false)
            setSubtaskToDelete(null)
          }
        }}
      />

      <TaskFormCancelConfirmDialog
        open={showCancelConfirm}
        onOpenChange={(open) => {
          if (!open) setShowCancelConfirm(false)
        }}
        subtaskCount={pendingSubtaskCount}
        onConfirm={resetAndClose}
      />

      <ConfirmAlertDialog
        open={showSaveOpenSubtasksConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setShowSaveOpenSubtasksConfirm(false)
            setPendingSaveFormData(null)
          }
        }}
        title="Saving will re-open this task"
        description={
          <>
            {incompleteDraftSubtasks.length} open subtask(s) have been added, so
            this task will be changed to <strong>incomplete</strong> on save.
          </>
        }
        cancelLabel="Go Back"
        confirmLabel="OK"
        onConfirm={() => {
          if (pendingSaveFormData) void handleSubmit(pendingSaveFormData)
        }}
        data-testid="saving-will-reopen-dialog"
      />

      <AssignSubtaskDialog
        open={assignTargetParentId !== null}
        onOpenChange={(open) => {
          if (!open) setAssignTargetParentId(null)
        }}
        parentTaskId={assignTargetParentId}
        onConfirm={handleAssignConfirm}
      />
    </TaskFormDialogContext.Provider>
  )
}

/**
 * Mounts the draft session context (scoped to this dialog subtree) and then
 * the dialog provider that consumes it. Draft state lives here because its
 * only purpose is the TaskForm dialog chain.
 */
export const TaskFormDialogProvider = ({
  children,
}: React.PropsWithChildren<EmptyObject>) => (
  <DraftSessionProvider>
    <TaskFormDialogProviderInner>{children}</TaskFormDialogProviderInner>
  </DraftSessionProvider>
)
