import { ConfirmAlertDialog } from '../primitives/overlays/ConfirmAlertDialog'

interface TaskFormCancelConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subtaskCount: number
  onDiscard: () => void
}

export const TaskFormCancelConfirmDialog = ({
  open,
  onOpenChange,
  subtaskCount,
  onDiscard,
}: TaskFormCancelConfirmDialogProps) => (
  <ConfirmAlertDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Are you sure you want to cancel?"
    description={`You have ${subtaskCount} unsaved ${subtaskCount === 1 ? 'subtask' : 'subtasks'}. ${subtaskCount === 1 ? 'It' : 'They'} will be discarded if you cancel this task.`}
    cancelLabel="Go Back"
    confirmLabel="Cancel and Discard Subtasks"
    confirmClassName="bg-destructive hover:bg-destructive/90 text-white"
    onConfirm={onDiscard}
    testId="cancel-confirm-dialog"
    cancelTestId="button-cancel-deny"
    confirmTestId="button-cancel-confirm"
  />
)
