/**
 * @fileoverview Form component for creating and editing tasks
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

import { toastError } from '@/hooks/useToasts'
import { uploadFiles } from '@/lib/attachment-upload'
import { RANK_FIELDS_COLUMNS } from '@/lib/columns'
import { getHasIncompleteSubtasks } from '@/lib/task-tree-utils'
import { cn } from '@/lib/utils'
import { useDraftSession } from '@/providers/DraftSessionProvider'
import { useSettings } from '@/providers/SettingsProvider'
import type {
  DeleteTaskArgs,
  MutateTaskContent,
} from '@/providers/TasksProvider'
import { useTaskMutations } from '@/providers/TasksProvider'
import type { LocalTask } from '@/types'
import {
  allRankFieldsNull,
  insertTaskSchemaRefined,
  type Task,
  TaskStatus,
  taskSchema,
} from '~/shared/schema'
import { Button } from '../primitives/Button'
import { Calendar } from '../primitives/forms/Calendar'
import { Checkbox } from '../primitives/forms/Checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../primitives/forms/Form'
import { Textarea } from '../primitives/forms/Textarea'
import { TimeInput } from '../primitives/forms/TimeInput'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../primitives/overlays/Popover'
import { TagChain } from '../primitives/TagChain'
import { SubtaskBlockedTooltip } from '../SubtaskBlockedTooltip'
import { AttachmentsCard, type AttachmentsCardHandle } from './AttachmentsCard'
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
  inProgressStartedAt: true,
})

type TaskFormDefaults = z.infer<typeof taskFormDefaultsSchema>

type TaskFormValues = z.infer<ReturnType<typeof insertTaskSchemaRefined>>

interface DateCreatedInputProps {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
}

const DateCreatedInput = ({ value, onChange }: DateCreatedInputProps) => (
  <FormItem className="flex items-center justify-between gap-4">
    <div>
      <FormLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Date Created
      </FormLabel>
    </div>
    <Popover>
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            variant={'outline'}
            className={cn(
              'w-auto bg-secondary/10 border-white/5 h-8 text-xs py-1 px-3 font-normal',
              !value && 'text-muted-foreground',
            )}
          >
            {value ? format(value, 'PPP') : <span>Pick a date</span>}
            <CalendarIcon className="size-3 ml-2 opacity-50" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-card border-white/10 z-[300]"
        align="end"
      >
        <div className="p-3 border-b border-white/5 bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground text-center">
          Select Creation Date
        </div>
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          autoFocus
          className="rounded-md border-0"
        />
      </PopoverContent>
    </Popover>
  </FormItem>
)

export interface TaskFormProps {
  onSubmit: (data: MutateTaskContent) => Promise<LocalTask | undefined>
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

  const {
    fieldConfig: {
      timeSpent: { visible: timeSpentVisible, required: timeSpentRequired },
    },
  } = settings

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
  }, [settings.fieldConfig, form, timeSpentRequired])

  const { subscribeToIdReplacement } = useTaskMutations()
  const queryClient = useQueryClient()
  const attachmentsRef = useRef<AttachmentsCardHandle>(null)
  const isEditingExisting = !!initialData && !isDraft

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (data) => {
          const submitted: MutateTaskContent = { ...data }
          if (
            submitted.status === TaskStatus.COMPLETED &&
            !submitted.completedAt
          ) {
            submitted.completedAt = new Date()
          }

          const isNewTask = !initialData || initialData.id <= 0
          if (isNewTask) {
            // Capture staged files before the dialog closes and unmounts this component.
            const files = attachmentsRef.current?.getStagedFiles() ?? []
            const localTask = await onSubmit(submitted)
            if (files.length > 0 && localTask) {
              const unsub = subscribeToIdReplacement(async (tempId, realId) => {
                if (tempId !== localTask.id) return
                unsub()
                const errors = await uploadFiles(files, realId, queryClient)
                for (const msg of errors) {
                  toastError({ title: msg })
                }
              })
            }
          } else {
            const committed = await attachmentsRef.current?.commit()
            if (committed === false) return
            await onSubmit(submitted)
          }
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
                <FormLabel className="text-sm font-medium">Task Name</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Task name"
                    data-testid="task-name-input"
                    className="bg-secondary/20 border-white/5 min-h-0 py-2 text-lg focus-visible:ring-primary/50 resize-none overflow-hidden leading-snug"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = `${target.scrollHeight}px`
                    }}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div
          className="min-h-0 overflow-y-auto [scrollbar-gutter:stable_both-edges] py-2"
          data-testid="form-scroll-region"
        >
          <div className="flex-1 space-y-5 px-3">
            {visibleRankFields.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
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
                  <FormLabel className="text-sm font-medium">
                    Description
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details..."
                      className="bg-secondary/20 border-white/5 min-h-[50px] max-h-[200px] resize-none focus-visible:ring-primary/50"
                      style={{ fieldSizing: 'content' } as React.CSSProperties}
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

            <div className="flex flex-col gap-4 mt-2 pb-4">
              <FormField
                control={form.control}
                name="createdAt"
                render={({ field }) => (
                  <DateCreatedInput
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              {initialData?.status === TaskStatus.COMPLETED &&
                initialData?.completedAt && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Date Completed
                    </div>
                    <div className="text-xs text-emerald-400/70 bg-emerald-400/5 px-2 py-1 rounded border border-emerald-400/10">
                      {format(new Date(initialData.completedAt), 'PPP p')}
                    </div>
                  </div>
                )}

              {timeSpentVisible && (
                <FormField
                  control={form.control}
                  name="timeSpent"
                  render={() => (
                    <FormItem className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-4">
                        <FormLabel
                          className="text-[10px] uppercase tracking-wider text-muted-foreground"
                          isRequired={timeSpentRequired}
                        >
                          Time Spent
                        </FormLabel>
                        <SubtaskBlockedTooltip blocked={hasIncompleteSubtasks}>
                          <TimeInput
                            durationMs={form.watch('timeSpent') || 0}
                            onDurationChange={(ms) =>
                              form.setValue('timeSpent', ms, {
                                shouldValidate: true,
                              })
                            }
                            disabled={hasIncompleteSubtasks}
                            className="w-16 h-8 text-xs bg-secondary/20 border-white/5 text-center"
                            data-testid="time-spent-input"
                          />
                        </SubtaskBlockedTooltip>
                      </div>
                      <FormMessage className="text-[11px] text-right" />
                    </FormItem>
                  )}
                />
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
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Completed
                  </div>
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
                      void form.trigger('timeSpent')
                    }}
                    className="border-emerald-500/50 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    data-testid="mark-completed-checkbox"
                  />
                </label>
              </SubtaskBlockedTooltip>
            </div>
          </div>
        </div>

        <AttachmentsCard
          ref={attachmentsRef}
          taskId={
            initialData?.id != null && initialData.id > 0
              ? initialData.id
              : null
          }
        />

        <div className="pt-2 pb-4 px-4 flex gap-3 ">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-12 border-white/10 bg-background hover:bg-secondary/20 text-lg"
            data-testid="cancel-button"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isValid}
            className="flex-1 h-12 bg-primary hover:bg-primary/90 text-white font-bold text-lg disabled:bg-primary/80 disabled:cursor-not-allowed"
            data-testid="submit-button"
          >
            {isEditingExisting ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
