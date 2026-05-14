import {
  ConfirmAlertDialog,
  type ConfirmAlertDialogProps,
} from '../primitives/overlays/ConfirmAlertDialog'

interface AddSubtaskCompletedConfirmDialogProps
  extends Pick<
    ConfirmAlertDialogProps,
    'open' | 'onOpenChange' | 'onConfirm'
  > {}

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
    onConfirm={onConfirm}
    data-testid="add-subtask-completed-confirm-dialog"
  />
)
