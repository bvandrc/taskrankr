/**
 * @fileoverview Shared confirmation dialog built on @radix-ui AlertDialog
 * primitives. Renders via an explicit portal so it stacks correctly above any
 * ancestor Dialog (z-[110] > Dialog's z-50).
 */

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from './AlertDialog'

interface ConfirmAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  /** Defaults to "Cancel". */
  cancelLabel?: string
  confirmLabel: string
  onConfirm: () => void
  /** Tailwind classes applied to the confirm button. */
  confirmClassName?: string
  testId?: string
  cancelTestId?: string
  confirmTestId?: string
}

/**
 * Generic confirm/cancel alert dialog. Use instead of writing a bespoke
 * AlertDialog for each confirmation prompt.
 */
export const ConfirmAlertDialog = ({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel,
  onConfirm,
  confirmClassName,
  testId,
  cancelTestId,
  confirmTestId,
}: ConfirmAlertDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogPortal>
      <AlertDialogOverlay className="z-[110]" />
      <AlertDialogPrimitive.Content
        className={cn(
          'fixed left-[50%] top-[50%] z-[110] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg duration-200',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
          'bg-card border-white/10',
        )}
        data-testid={testId}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel
            className="bg-secondary/50 border-white/5 hover:bg-white/10"
            data-testid={cancelTestId}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={confirmClassName}
            data-testid={confirmTestId}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  </AlertDialog>
)
