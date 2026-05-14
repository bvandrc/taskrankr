import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../primitives/overlays/AlertDialog'

interface AddSubtaskCompletedConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** Shown when the user clicks Add Subtask on a completed parent task. */
export const AddSubtaskCompletedConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: AddSubtaskCompletedConfirmDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent
      className="bg-card border-white/10"
      data-testid="add-subtask-completed-confirm-dialog"
    >
      <AlertDialogHeader>
        <AlertDialogTitle>Task is already completed</AlertDialogTitle>
        <AlertDialogDescription>
          Adding a subtask will mark this task as incomplete. This won&apos;t
          take effect until you save.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-col sm:flex-row gap-2">
        <AlertDialogCancel
          className="bg-secondary/50 border-white/5 hover:bg-white/10"
          data-testid="button-add-subtask-completed-cancel"
        >
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className="bg-primary hover:bg-primary/90 text-white"
          data-testid="button-add-subtask-completed-confirm"
        >
          Add Subtask
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)
