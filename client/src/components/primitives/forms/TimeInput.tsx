import React from 'react'
import {
  hoursToMilliseconds,
  hoursToMinutes,
  intervalToDuration,
  minutesToMilliseconds,
} from 'date-fns'

import { Input } from './Input'

const MAX_MINUTES = hoursToMinutes(1) - 1

const getDurationMs = (hours: number, minutes: number) =>
  hoursToMilliseconds(hours) + minutesToMilliseconds(minutes)

const parseNumericOnChange = (e: React.ChangeEvent<HTMLInputElement>) =>
  Math.max(0, Number.parseInt(e.target.value) || 0)

type TimeInputProps = {
  durationMs: number
  onDurationChange: (durationMs: number) => void
  onBlur?: () => void
  disabled?: boolean
  className?: string
  'data-testid'?: string
}

export const TimeInput = React.forwardRef<HTMLDivElement, TimeInputProps>(
  (
    {
      durationMs,
      onDurationChange,
      onBlur,
      disabled,
      className = 'w-16 h-8 text-center text-sm',
      'data-testid': testId = 'time-input',
    },
    ref,
  ) => {
    const { hours = 0, minutes = 0 } = intervalToDuration({
      start: 0,
      end: durationMs,
    })

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      const input = e.target
      requestAnimationFrame(() => {
        input.select()
      })
    }

    return (
      <div ref={ref} className="flex items-center gap-2" data-testid={testId}>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            step={1}
            value={hours.toString()}
            onChange={(e) => {
              const h = parseNumericOnChange(e)
              onDurationChange(getDurationMs(h, minutes))
            }}
            onFocus={handleFocus}
            onBlur={onBlur}
            disabled={disabled}
            className={className}
            data-testid={`${testId}-hours`}
          />
          <span className="text-xs text-muted-foreground">h</span>
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={MAX_MINUTES}
            step={1}
            value={minutes.toString()}
            onChange={(e) => {
              const m = Math.min(MAX_MINUTES, parseNumericOnChange(e))
              onDurationChange(getDurationMs(hours, m))
            }}
            onFocus={handleFocus}
            onBlur={onBlur}
            disabled={disabled}
            className={className}
            data-testid={`${testId}-minutes`}
          />
          <span className="text-xs text-muted-foreground">m</span>
        </div>
      </div>
    )
  },
)
