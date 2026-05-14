/**
 * Reads `body.message` from an API error response and fires a destructive toast.
 * Falls back to `fallback` when the body doesn't carry a string message.
 */
import { toast } from '@/hooks/useToast'

export function toastApiError(body: unknown, fallback: string) {
  const message =
    body !== null &&
    typeof body === 'object' &&
    'message' in body &&
    typeof (body as { message: unknown }).message === 'string'
      ? (body as { message: string }).message
      : fallback
  toast({ title: 'Error', description: message, variant: 'destructive' })
}
