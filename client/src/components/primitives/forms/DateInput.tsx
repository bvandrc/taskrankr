import { addDays, format } from 'date-fns'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import type { Matcher } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '../Button'
import { Popover, PopoverContent, PopoverTrigger } from '../overlays/Popover'
import { DayPicker } from './DayPicker'
import { FormControl, FormItem, FormLabel, FormMessage } from './Form'

interface DateInputProps {
  'data-testid'?: string
  label: string
  labelClassName?: string
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  minDate?: Date
  maxDate?: Date
  popoverHeader?: string
  buttonClassName?: string
  canClear?: boolean
}

export const DateInput = ({
  'data-testid': testId,
  label,
  labelClassName,
  value,
  onChange,
  minDate,
  maxDate,
  popoverHeader,
  buttonClassName,
  canClear = true,
}: DateInputProps) => {
  const disabledMatcher: Matcher[] = []
  if (minDate) disabledMatcher.push({ before: addDays(minDate, 1) })
  if (maxDate) disabledMatcher.push({ after: addDays(maxDate, -1) })

  return (
    <FormItem className="space-y-0">
      <div className="flex items-center justify-between gap-4">
        <FormLabel className={labelClassName}>{label}</FormLabel>
        <div className="flex items-center gap-1">
          {canClear && value && (
            <Button
              type="button"
              variant="ghost"
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onChange(undefined)}
              aria-label={`Clear ${label}`}
            >
              <X className="size-3" />
            </Button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-40 bg-secondary/10 border-white/5 h-8 text-xs py-1 px-2 font-normal justify-between',
                    !value && 'text-muted-foreground',
                    buttonClassName,
                  )}
                  data-testid={testId}
                >
                  {value ? format(value, 'PPP') : <span>Pick a date</span>}
                  <CalendarIcon className="size-3 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 bg-card border-white/10 z-300"
              align="end"
            >
              {popoverHeader && (
                <div className="p-3 border-b border-white/5 bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground text-center">
                  {popoverHeader}
                </div>
              )}
              <DayPicker
                mode="single"
                selected={value}
                onSelect={onChange}
                disabled={
                  disabledMatcher.length > 0 ? disabledMatcher : undefined
                }
                autoFocus
                className="rounded-md border-0"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <FormMessage />
    </FormItem>
  )
}
