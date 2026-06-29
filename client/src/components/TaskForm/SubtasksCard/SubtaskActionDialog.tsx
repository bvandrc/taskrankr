/**
 * @fileoverview Action dialog for subtask deletion — offers Cancel, Delete, or Remove as Subtask
 */

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCloseButton,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from '@/components/primitives/overlays/AlertDialog'
import { cn } from '@/lib/utils'

interface SubtaskActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskName: string
  onDelete: () => void
  onRemoveAsSubtask: () => void
}

export const SubtaskActionDialog = ({
  open,
  onOpenChange,
  taskName,
  onDelete,
  onRemoveAsSubtask,
}: SubtaskActionDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogPortal>
      <AlertDialogOverlay className="z-110" />
      <AlertDialogPrimitive.Content
        className={cn(
          'fixed left-[50%] top-[50%] z-110 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg duration-200',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
          'bg-card border-white/10',
        )}
      >
        <AlertDialogCloseButton
          onClose={() => onOpenChange(false)}
          data-testid="button-close-subtask-action"
        />
        <AlertDialogHeader>
          <AlertDialogTitle>What would you like to do?</AlertDialogTitle>
          <AlertDialogDescription>
            for "{taskName}" subtask
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogAction
            onClick={onDelete}
            className="bg-danger/70 hover:bg-danger/90 text-white"
            data-testid="button-subtask-delete"
          >
            Delete Permanently
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onRemoveAsSubtask}
            className="bg-secondary/80 hover:bg-secondary text-foreground"
            data-testid="button-remove-as-subtask"
          >
            Remove as Subtask
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  </AlertDialog>
)
