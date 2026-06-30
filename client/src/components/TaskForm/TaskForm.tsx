/**
 * @fileoverview Form component for creating and editing tasks
 */

import { useCallback, useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

import { RANK_FIELDS_COLUMNS } from '@/lib/columns'
import { getHasIncompleteSubtasks } from '@/lib/task-tree-utils'
import { cn } from '@/lib/utils'
import { useDraftSession } from '@/providers/DraftSessionProvider'
import { useSettings } from '@/providers/SettingsProvider'
import type {
  DeleteTaskArgs,
  MutateTaskContent,
} from '@/providers/TasksProvider'
import {
  allRankFieldsNull,
  insertTaskSchemaRefined,
  type Task,
  TaskStatus,
  taskSchema,
} from '~/shared/schema'
import { Button } from '../primitives/Button'
import { Checkbox } from '../primitives/forms/Checkbox'
import { DateInput } from '../primitives/forms/DateInput'
import {
  FieldLabel,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../primitives/forms/Form'
import { Textarea } from '../primitives/forms/Textarea'
import { TagChain } from '../primitives/TagChain'
import { SubtaskBlockedTooltip } from '../SubtaskBlockedTooltip'
import { RankFieldSelect } from './RankFieldSelect'
import { SubtasksCard } from './SubtasksCard'
import { useTaskFormParentChain } from './useTaskFormParentChain'

const STUB_TASK: Task = taskSchema.parse({
  id: 0,
  userId: '',
  name: '',
  ...allRankFieldsNull,
} satisfies z.input<typeof taskSchema>)

const taskFormDefaultsSchema = taskSchema.omit({
  id: true,
  userId: true,
})

type TaskFormDefaults = z.infer<typeof taskFormDefaultsSchema>

type TaskFormValues = z.infer<ReturnType<typeof insertTaskSchemaRefined>>

export interface TaskFormProps {
  onSubmit: (data: MutateTaskContent) => void
  initialData?: Task
  parentId?: number | null
  onCancel: () => void
  onAddSubtask: (parentId: number, formData?: MutateTaskContent) => void
  onEditSubtask: (task: Task) => void
  onDeleteSubtask: (task: DeleteTaskArgs) => void
  onAssignSubtask: (task: Task, formData?: MutateTaskContent) => void
  defaultFormData?: MutateTaskContent
  isDraft?: boolean
  showHidden?: boolean
  onShowHiddenChange?: (show: boolean) => void
}

export const TaskForm = ({
  onSubmit,
  initialData,
  parentId,
  onCancel,
  onAddSubtask,
  onEditSubtask,
  onDeleteSubtask,
  onAssignSubtask,
  defaultFormData,
  isDraft = false,
  showHidden,
  onShowHiddenChange,
}: TaskFormProps) => {
  const parentChain = useTaskFormParentChain(parentId ?? undefined)
  const { tasksWithDrafts: allTasks } = useDraftSession()
  const { settings } = useSettings()
  const hasIncompleteSubtasks = initialData
    ? getHasIncompleteSubtasks(allTasks, initialData.id)
    : false

  const visibleRankFields = useMemo(
    () =>
      RANK_FIELDS_COLUMNS.filter(
        (attr) => settings.fieldConfig[attr.name].visible,
      ),
    [settings.fieldConfig],
  )

  const formSchema = useMemo(
    () => insertTaskSchemaRefined(settings),
    [settings],
  )

  const getFormDefaults = useCallback(
    (data: TaskFormDefaults | undefined): TaskFormDefaults =>
      taskFormDefaultsSchema.parse(
        data ??
          defaultFormData ??
          ({
            ...allRankFieldsNull,
            name: '',
            parentId,
          } satisfies z.input<typeof taskFormDefaultsSchema>),
      ),
    [parentId, defaultFormData],
  )

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: getFormDefaults(initialData),
  })
  const {
    formState: { isValid },
  } = form
  const nameValue = form.watch('name')

  useEffect(() => {
    form.reset(getFormDefaults(initialData))
  }, [initialData, form, getFormDefaults])

  // biome-ignore lint/correctness/useExhaustiveDependencies: is necessary
  useEffect(() => {
    void form.trigger()
  }, [settings.fieldConfig, form])

  const isEditingExisting = !!initialData && !isDraft

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          const submitted: MutateTaskContent = { ...data }
          if (
            submitted.status === TaskStatus.COMPLETED &&
            !submitted.completedAt
          ) {
            submitted.completedAt = new Date()
          }
          onSubmit(submitted)
        })}
        className="flex flex-col h-full"
        data-testid="task-form"
        data-tier={parentChain.length}
      >
        <div className="pb-2  px-4 pt-2">
          <TagChain items={parentChain} label="Parent" className="px-1 mb-2" />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Task Name</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Task name"
                    data-testid="task-name-input"
                    className="bg-secondary/20 border-white/5 min-h-0 py-2 text-lg focus-visible:ring-primary/50 resize-none leading-snug"
                    rows={1}
                    style={{ fieldSizing: 'content' }}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div
          data-testid="form-scroll-region"
          className="min-h-0 overflow-y-auto scrollbar-gutter-both py-2"
        >
          <div className="flex-1 space-y-4 px-3">
            {visibleRankFields.length > 0 && (
              <div data-testid="rank-fields" className="grid grid-cols-2 gap-4">
                {visibleRankFields.map(({ name, label, levels }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <RankFieldSelect
                        name={name}
                        label={label}
                        levels={levels}
                        field={field}
                        isRequired={settings.fieldConfig[name].required}
                      />
                    )}
                  />
                ))}
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details..."
                      className="bg-secondary/20 border-white/5 min-h-12.5 max-h-50 resize-none focus-visible:ring-primary/50"
                      style={{ fieldSizing: 'content' }}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <SubtasksCard
              task={initialData ?? STUB_TASK}
              onAddSubtask={(pid) => onAddSubtask(pid, form.getValues())}
              onEditSubtask={onEditSubtask}
              onDeleteSubtask={onDeleteSubtask}
              onAssignSubtask={(t) => onAssignSubtask(t, form.getValues())}
              disableAddSubtask={!nameValue}
              showHidden={showHidden}
              onShowHiddenChange={onShowHiddenChange}
            />

            <FormField
              control={form.control}
              name="createdAt"
              render={({ field }) => (
                <DateInput
                  label="Date Created"
                  value={field.value}
                  onChange={field.onChange}
                  popoverHeader="Select Creation Date"
                  buttonClassName="w-auto"
                  data-testid="date-created-picker"
                />
              )}
            />

            {initialData?.status === TaskStatus.COMPLETED &&
              initialData?.completedAt && (
                <div className="flex items-center justify-between gap-4">
                  <FieldLabel>Date Completed</FieldLabel>
                  <div className="text-xs text-emerald-400/70 bg-emerald-400/5 px-2 py-1 rounded border border-emerald-400/10">
                    {format(new Date(initialData.completedAt), 'PPP p')}
                  </div>
                </div>
              )}

            <SubtaskBlockedTooltip blocked={hasIncompleteSubtasks}>
              {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is an input. */}
              <label
                className={cn(
                  'flex items-center justify-between gap-4',
                  hasIncompleteSubtasks
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer',
                )}
                data-testid="checkbox-mark-completed"
              >
                <FieldLabel>Completed</FieldLabel>
                <Checkbox
                  checked={form.watch('status') === TaskStatus.COMPLETED}
                  disabled={hasIncompleteSubtasks}
                  onCheckedChange={(checked) => {
                    const newStatus =
                      checked === true
                        ? TaskStatus.COMPLETED
                        : ((initialData?.status !== TaskStatus.COMPLETED
                            ? initialData?.status
                            : TaskStatus.OPEN) ?? TaskStatus.OPEN)
                    form.setValue('status', newStatus, {
                      shouldValidate: true,
                    })
                  }}
                  className="border-emerald-500/50 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  data-testid="mark-completed-checkbox"
                />
              </label>
            </SubtaskBlockedTooltip>
          </div>
        </div>

        <div className="p-4 flex gap-3 ">
          <Button
            data-testid="cancel-button"
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-12 border-white/10 bg-background hover:bg-secondary/20 text-lg"
          >
            Cancel
          </Button>
          <Button
            data-testid="submit-button"
            type="submit"
            disabled={!isValid}
            className="flex-1 h-12 bg-primary hover:bg-primary/90 text-white font-bold text-lg disabled:bg-primary/80 disabled:cursor-not-allowed"
          >
            {isEditingExisting ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
