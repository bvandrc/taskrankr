/**
 * @fileoverview Dropdown menu primitive components.
 * Wraps @radix-ui/react-dropdown-menu with styled variants.
 */

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle, type LucideIcon } from 'lucide-react'

import { cn, forwardRefHelper } from '@/lib/utils'
import { Link } from './Link'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal
export const DropdownMenuSub = DropdownMenuPrimitive.Sub
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

export const DropdownMenuSubTrigger = forwardRefHelper<
  typeof DropdownMenuPrimitive.SubTrigger,
  { inset?: boolean }
>(
  ({ className, inset, children, ...props }, ref) => (
    <DropdownMenuPrimitive.SubTrigger
      {...props}
      ref={ref}
      className={cn(
        'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        inset && 'pl-8',
        className,
      )}
    >
      {children}
      <ChevronRight className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  ),
  DropdownMenuPrimitive.SubTrigger,
)

export const DropdownMenuSubContent = forwardRefHelper(
  ({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.SubContent
      {...props}
      ref={ref}
      className={cn(
        'z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]',
        className,
      )}
    />
  ),
  DropdownMenuPrimitive.SubContent,
)

export const DropdownMenuContent = forwardRefHelper(
  ({ className, sideOffset = 4, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        {...props}
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-32 overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]',
          className,
        )}
      />
    </DropdownMenuPrimitive.Portal>
  ),
  DropdownMenuPrimitive.Content,
)

export const DropdownMenuItem = forwardRefHelper<
  typeof DropdownMenuPrimitive.Item,
  { inset?: boolean; label: React.ReactNode; icon?: LucideIcon; href?: string }
>(({ className, inset, label, icon: IconComponent, href, ...props }, ref) => {
  const dropdownMenuItem = (
    <DropdownMenuPrimitive.Item
      {...props}
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        inset && 'pl-8',
        className,
      )}
    >
      {IconComponent && <IconComponent className="size-4 mr-2" />}
      {label}
    </DropdownMenuPrimitive.Item>
  )

  return href ? (
    <Link href={href} newTab={false}>
      {dropdownMenuItem}
    </Link>
  ) : (
    dropdownMenuItem
  )
}, DropdownMenuPrimitive.Item)

export const DropdownMenuCheckboxItem = forwardRefHelper(
  ({ className, children, checked, ...props }, ref) => (
    <DropdownMenuPrimitive.CheckboxItem
      {...props}
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      checked={checked}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  ),
  DropdownMenuPrimitive.CheckboxItem,
)

export const DropdownMenuRadioItem = forwardRefHelper(
  ({ className, children, ...props }, ref) => (
    <DropdownMenuPrimitive.RadioItem
      {...props}
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  ),
  DropdownMenuPrimitive.RadioItem,
)

export const DropdownMenuLabel = forwardRefHelper<
  typeof DropdownMenuPrimitive.Label,
  { inset?: boolean }
>(
  ({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Label
      {...props}
      ref={ref}
      className={cn(
        'px-2 py-1.5 text-sm font-semibold',
        inset && 'pl-8',
        className,
      )}
    />
  ),
  DropdownMenuPrimitive.Label,
)

export const DropdownMenuSeparator = forwardRefHelper(
  ({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.Separator
      {...props}
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-muted', className)}
    />
  ),
  DropdownMenuPrimitive.Separator,
)

export const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      {...props}
      className={cn('ml-auto text-xs tracking-widest opacity-60', className)}
    />
  )
}
