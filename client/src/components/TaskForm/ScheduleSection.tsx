import { useEffect } from 'react'
import { type Control, useFormContext } from 'react-hook-form'

import { getRankFieldStyle } from '@/lib/rank-field-styles'
import { cn } from '@/lib/utils'
import {
  type MutateTask,
  Priority,
  RankField,
  SCHEDULE_SEQUENCE,
  type TaskSchedule,
} from '~/shared/schema'
import { getLevelWeight } from '~/shared/utils/task-utils'
import { DateInput } from '../primitives/forms/DateInput'
import { FieldLabel, FormField } from '../primitives/forms/Form'

/** Returns the nearest preceding set date in the sequence. */
const getPrecedingDate = (
  key: keyof TaskSchedule,
  schedule: TaskSchedule | null | undefined,
): Date | undefined => {
  const idx = SCHEDULE_SEQUENCE.indexOf(key)
  for (let i = idx - 1; i >= 0; i--) {
    const d = schedule?.[SCHEDULE_SEQUENCE[i]]
    if (d) return d
  }
  return undefined
}

/** Returns the nearest following set date in the sequence. */
const getFollowingDate = (
  key: keyof TaskSchedule,
  schedule: TaskSchedule | null | undefined,
): Date | undefined => {
  const idx = SCHEDULE_SEQUENCE.indexOf(key)
  for (let i = idx + 1; i < SCHEDULE_SEQUENCE.length; i++) {
    const d = schedule?.[SCHEDULE_SEQUENCE[i]]
    if (d) return d
  }
  return undefined
}

interface ScheduleRowProps {
  control: Control<MutateTask>
  scheduleKey: keyof TaskSchedule
  label: string
  labelClassName?: string
  schedule: TaskSchedule | null | undefined
}

const ScheduleRow = ({
  control,
  scheduleKey,
  label,
  labelClassName,
  schedule,
}: ScheduleRowProps) => (
  <FormField
    control={control}
    name={`schedule.${scheduleKey}`}
    render={({ field }) => (
      <DateInput
        label={label}
        labelClassName={cn('text-xs', labelClassName)}
        value={field.value ?? undefined}
        onChange={field.onChange}
        minDate={getPrecedingDate(scheduleKey, schedule)}
        maxDate={getFollowingDate(scheduleKey, schedule)}
        data-testid={`schedule-${scheduleKey}-picker`}
      />
    )}
  />
)

export const ScheduleSection = () => {
  const { control, watch, getValues, setValue } = useFormContext<MutateTask>()
  const schedule = watch('schedule')
  const basePriority = watch('priority')

  useEffect(() => {
    if (!basePriority) {
      const current = getValues('schedule') ?? {}
      setValue('schedule', {
        hideUntil: current.hideUntil,
        dueAt: current.dueAt,
      })
    }
  }, [basePriority, getValues, setValue])
  const basePriorityWeight = basePriority ? getLevelWeight(basePriority) : null
  const escalationRows = Object.values(Priority).filter(
    (level) =>
      basePriorityWeight != null && getLevelWeight(level) > basePriorityWeight,
  )

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel className="mb-2">Schedule</FieldLabel>
      <div className="flex flex-col gap-3 mx-auto max-w-[95%] py-3 px-4 rounded-lg border border-white/10 bg-card">
        <ScheduleRow
          control={control}
          scheduleKey="hideUntil"
          label="Hide Until"
          schedule={schedule}
        />

        {escalationRows.length > 0 ? (
          escalationRows.map((level) => (
            <ScheduleRow
              key={level}
              control={control}
              scheduleKey={level}
              label={level.charAt(0).toUpperCase() + level.slice(1)}
              labelClassName={cn(
                'px-1.5 py-0.5 rounded border text-xs font-bold uppercase tracking-wider',
                getRankFieldStyle(RankField.PRIORITY, level),
              )}
              schedule={schedule}
            />
          ))
        ) : (
          <p className="text-[11px] text-yellow-300/70 italic pl-0.5">
            Set an initial priority to enable priority escalation schedule
          </p>
        )}

        <ScheduleRow
          control={control}
          scheduleKey="dueAt"
          label="Due At"
          schedule={schedule}
        />
      </div>
    </div>
  )
}
