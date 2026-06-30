/**
 * @fileoverview Calendar date picker component. Wraps react-day-picker (v9) with
 * custom styling and navigation icons.
 */

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import {
  type ChevronProps,
  DayPicker as ReactDayPicker,
} from 'react-day-picker'

import { cn } from '@/lib/utils'
import { buttonVariants } from '../Button'

export type DayPickerProps = React.ComponentProps<typeof ReactDayPicker>

const ORIENTATION_ICONS = {
  left: ChevronLeft,
  right: ChevronRight,
  up: ChevronUp,
  down: ChevronDown,
} as const

const Chevron = ({ className, orientation, ...props }: ChevronProps) => {
  const Icon = ORIENTATION_ICONS[orientation ?? 'left']
  return <Icon {...props} className={cn('size-4', className)} />
}

export const DayPicker = ({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps) => (
  <ReactDayPicker
    showOutsideDays={showOutsideDays}
    className={cn('p-3', className)}
    classNames={{
      months: 'relative flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
      month: 'space-y-4',
      month_caption: 'flex justify-center pt-1 items-center',
      caption_label: 'text-m font-medium',
      nav: 'absolute top-0 inset-x-0 flex justify-between items-center pt-1 px-1',
      button_previous: cn(
        buttonVariants({ variant: 'outline' }),
        'size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
      ),
      button_next: cn(
        buttonVariants({ variant: 'outline' }),
        'size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
      ),
      month_grid: 'w-full border-collapse space-y-1',
      weekdays: 'flex',
      weekday: 'text-muted-foreground rounded-md w-9 font-normal text-s',
      week: 'flex w-full mt-2',
      day: 'size-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
      day_button: cn(
        buttonVariants({ variant: 'ghost' }),
        'size-9 p-0 font-normal aria-selected:opacity-100',
      ),
      range_end: 'day-range-end',
      selected:
        'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
      today: 'bg-accent text-accent-foreground',
      outside:
        'day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground',
      disabled: 'text-muted-foreground opacity-50',
      range_middle:
        'aria-selected:bg-accent aria-selected:text-accent-foreground',
      hidden: 'invisible',
      ...classNames,
    }}
    components={{ Chevron }}
    {...props}
  />
)
