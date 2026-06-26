import { cn } from '@/lib/utils'

function barColor(
  value: number,
  yellowThreshold: number,
  redThreshold: number,
): string {
  if (value >= redThreshold) return 'bg-red-500'
  if (value >= yellowThreshold) return 'bg-amber-500'
  return 'bg-emerald-500'
}

/**
 * Horizontal progress bar with threshold-driven color.
 * `value` is a 0–1 fraction. Color shifts to amber at `yellowThreshold`
 * and red at `redThreshold`.
 */
export const ProgressBar = ({
  value,
  yellowThreshold = 0.8,
  redThreshold = 0.95,
}: {
  value: number
  yellowThreshold?: number
  redThreshold?: number
}) => (
  <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
    <div
      className={cn(
        'h-full rounded-full transition-all',
        barColor(value, yellowThreshold, redThreshold),
      )}
      style={{ width: `${Math.min(value * 100, 100)}%` }}
    />
  </div>
)
