import { cn } from '@/lib/utils'

/**
 * Spinning loading indicator. Use `fullScreen` for auth/page-level loading gates,
 * `centered` for Suspense fallbacks and in-page loading states, and `size="sm"`
 * for compact inline contexts like card sections.
 */
export const Spinner = ({
  size = 'md',
  fullScreen = false,
  centered = false,
}: {
  size?: 'sm' | 'md'
  fullScreen?: boolean
  centered?: boolean
}) => {
  const el = (
    <div
      className={cn(
        'rounded-full border-muted border-t-primary animate-spin',
        size === 'sm' ? 'size-4 border-2' : 'size-9 border-3',
      )}
    />
  )

  if (fullScreen) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        data-testid="page-spinner"
      >
        {el}
      </div>
    )
  }

  if (centered) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="page-spinner"
      >
        {el}
      </div>
    )
  }

  return el
}
