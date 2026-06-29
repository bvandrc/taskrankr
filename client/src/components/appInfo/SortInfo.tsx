/**
 * @fileoverview Collapsible sort order info component showing primary/secondary sort criteria.
 */

import { SORT_LABELS } from '@/lib/columns'
import { RANK_FIELD_ENUMS, type RankFieldValueMap } from '@/lib/constants'
import { getRankFieldStyle } from '@/lib/rank-field-styles'
import {
  SORT_DIRECTIONS,
  SORT_ORDER_MAP,
  SortDirection,
} from '@/lib/task-tree-utils'
import { cn } from '@/lib/utils'
import { RankFields } from '~/shared/schema'
import { CollapsibleCard } from '../primitives/CollapsibleCard'

const SORT_INFO_CONFIG = RankFields.map((key) => ({
  name: SORT_LABELS[key],
  sortOrderInfo: SORT_ORDER_MAP[key].map((field) => ({
    attr: field,
    value: Object.values(RANK_FIELD_ENUMS[field]).at(
      SORT_DIRECTIONS[field] === SortDirection.DESC ? -1 : 0,
    ),
  })),
}))

interface SortInfoProps {
  defaultExpanded?: boolean
}

export const SortInfo = ({ defaultExpanded = false }: SortInfoProps) => (
  <CollapsibleCard
    title={<h3 className="font-semibold text-foreground">Sort Order Info</h3>}
    defaultOpen={defaultExpanded}
    contentClassName="mt-3"
    data-testid="button-sort-info-toggle"
  >
    <div
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm"
      data-testid="sort-info-content"
    >
      {SORT_INFO_CONFIG.map((item) => (
        <div
          key={item.name}
          className="p-3 bg-secondary/20 rounded-md"
          data-testid={`sort-info-${item.name.toLowerCase()}`}
        >
          <p className="font-medium text-foreground mb-1">{item.name}</p>
          <ol
            className={cn(
              'text-xs list-decimal list-inside',
              item.sortOrderInfo.length > 1 && 'space-y-0.5',
            )}
          >
            {item.sortOrderInfo.map((c) => {
              const style = getRankFieldStyle(
                c.attr,
                c.value as RankFieldValueMap[typeof c.attr],
                '',
              )
              return (
                <li
                  key={`${c.attr} ${c.value}`}
                  className="text-muted-foreground"
                >
                  {SORT_LABELS[c.attr]} (
                  {style ? (
                    <span className={cn('font-medium', style)}>{c.value}</span>
                  ) : (
                    c.value
                  )}{' '}
                  first)
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  </CollapsibleCard>
)
