import { ConfirmAlertDialog } from '../primitives/overlays/ConfirmAlertDialog'

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
  <ConfirmAlertDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Task is already completed"
    description="Adding a subtask will mark this task as incomplete. This won't take effect until you save."
    confirmLabel="Add Subtask"
    confirmClassName="bg-primary hover:bg-primary/90 text-white"
    onConfirm={onConfirm}
    testId="add-subtask-completed-confirm-dialog"
    cancelTestId="button-add-subtask-completed-cancel"
    confirmTestId="button-add-subtask-completed-confirm"
  />
)
