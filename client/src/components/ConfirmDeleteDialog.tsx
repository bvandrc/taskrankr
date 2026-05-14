/**
 * @fileoverview Confirmation dialog for permanent task deletion
 */

import {
  ConfirmAlertDialog,
  type ConfirmAlertDialogProps,
} from './primitives/overlays/ConfirmAlertDialog'

interface ConfirmDeleteDialogProps
  extends Pick<ConfirmAlertDialogProps, 'open' | 'onOpenChange' | 'onConfirm'> {
  taskName: string
}

export const ConfirmDeleteDialog = ({
  open,
  onOpenChange,
  taskName,
  onConfirm,
}: ConfirmDeleteDialogProps) => (
  <ConfirmAlertDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Delete Task Permanently?"
    description={`This will permanently delete "${taskName}" and all its subtasks. This action cannot be undone.`}
    confirmLabel="Delete Permanently"
    confirmBtnVariant="danger"
    onConfirm={onConfirm}
    data-testid="confirm-delete-dialog"
  />
)
