import {
  ConfirmAlertDialog,
  type ConfirmAlertDialogProps,
} from '../primitives/overlays/ConfirmAlertDialog'

interface TaskFormCancelConfirmDialogProps
  extends Pick<ConfirmAlertDialogProps, 'open' | 'onOpenChange' | 'onConfirm'> {
  subtaskCount: number
}

export const TaskFormCancelConfirmDialog = ({
  open,
  onOpenChange,
  subtaskCount,
  onConfirm,
}: TaskFormCancelConfirmDialogProps) => (
  <ConfirmAlertDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Are you sure you want to cancel?"
    description={`You have ${subtaskCount} unsaved ${subtaskCount === 1 ? 'subtask' : 'subtasks'}. ${subtaskCount === 1 ? 'It' : 'They'} will be discarded if you cancel this task.`}
    cancelLabel="Go Back"
    confirmLabel="Cancel and Discard Subtasks"
    confirmBtnVariant="destructive"
    onConfirm={onConfirm}
    data-testid="cancel-task-form-confirm-dialog"
  />
)
