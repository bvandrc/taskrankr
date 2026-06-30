/**
 * @fileoverview Select dropdown component built on @radix-ui primitives.
 */

'use client'

import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

import { cn, forwardRefHelper } from '@/lib/utils'

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = forwardRefHelper(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Trigger
      {...props}
      ref={ref}
      className={cn(
        'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background data-placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
        className,
      )}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  ),
  SelectPrimitive.Trigger,
)

const SelectScrollButtonStyle =
  'flex cursor-default items-center justify-center py-1'

export const SelectScrollUpButton = forwardRefHelper(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollUpButton
      {...props}
      ref={ref}
      className={cn(SelectScrollButtonStyle, className)}
    >
      <ChevronUp className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  ),
  SelectPrimitive.ScrollUpButton,
)

export const SelectScrollDownButton = forwardRefHelper(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollDownButton
      {...props}
      ref={ref}
      className={cn(SelectScrollButtonStyle, className)}
    >
      <ChevronDown className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  ),
  SelectPrimitive.ScrollDownButton,
)

export const SelectContent = forwardRefHelper(
  ({ className, children, position = 'popper', ...props }, ref) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        {...props}
        ref={ref}
        className={cn(
          'relative z-50 max-h-[--radix-select-content-available-height] min-w-32 overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            position === 'popper' &&
              'h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  ),
  SelectPrimitive.Content,
)

export const SelectLabel = forwardRefHelper(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Label
      {...props}
      ref={ref}
      className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
    />
  ),
  SelectPrimitive.Label,
)

export const SelectItem = forwardRefHelper(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
      {...props}
      ref={ref}
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>

      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  ),
  SelectPrimitive.Item,
)

export const SelectSeparator = forwardRefHelper(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Separator
      {...props}
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-muted', className)}
    />
  ),
  SelectPrimitive.Separator,
)
