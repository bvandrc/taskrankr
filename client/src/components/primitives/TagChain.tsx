/**
 * @fileoverview Reusable chain of tags with optional label and separators
 */

import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface TagChainItem {
  id: number | string
  name: string
}

interface TagChainProps {
  items: TagChainItem[]
  /**
   * Appears before the chain of tags.
   */
  label?: string
  /**
   * @default `${label}s`
   */
  labelPlural?: string
  className?: string
}

export const TagChain = ({
  items,
  label,
  labelPlural,
  className,
}: TagChainProps) => {
  if (items.length === 0) return null

  const displayLabel = label
    ? items.length === 1
      ? label
      : (labelPlural ?? `${label}s`)
    : null

  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      {displayLabel && (
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
          {displayLabel}:
        </span>
      )}
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-secondary/10 px-2 py-0.5 rounded border border-gray-400">
            {item.name}
          </span>
          {idx < items.length - 1 && (
            <ChevronRight className="size-3 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  )
}
