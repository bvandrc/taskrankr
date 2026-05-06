import type { MergeExclusive } from 'type-fest'

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
} & MergeExclusive<{ fullScreen?: boolean }, { centered?: boolean }>) => {
  const el = (
    <div
      className={cn(
        'rounded-full border-muted border-t-primary animate-spin',
        size === 'sm' ? 'size-4 border-2' : 'size-9 border-3',
      )}
      data-testid="page-spinner"
    />
  )

  if (centered || fullScreen) {
    return (
      <div
        className={cn('flex items-center justify-center', {
          'flex-1': centered,
          'min-h-screen bg-background': fullScreen,
        })}
      >
        {el}
      </div>
    )
  }

  return el
}
