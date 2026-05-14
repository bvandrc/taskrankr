/**
 * @fileoverview Confirmation dialog for permanent task deletion
 */

import { ConfirmAlertDialog } from './primitives/overlays/ConfirmAlertDialog'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskName: string
  onConfirm: () => void
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
    confirmClassName="bg-destructive hover:bg-destructive/90 text-white"
    onConfirm={onConfirm}
    testId="confirm-delete-dialog"
    confirmTestId="button-delete-permanently"
  />
)
