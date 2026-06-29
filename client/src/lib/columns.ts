/** @fileoverview Display labels and column metadata for sort/rank fields. */

import { RankField, SortOption } from '~/shared/schema'
import { RANK_FIELD_ENUMS } from './constants'

export const SORT_LABELS = {
  [SortOption.PRIORITY]: 'Priority',
  [SortOption.EASE]: 'Ease',
  [SortOption.ENJOYMENT]: 'Enjoyment',
  [SortOption.TIME]: 'Time',
} as const satisfies Record<SortOption, string>

/** Rank-field column metadata in display order (name, label, enum values). */
export const RANK_FIELDS_COLUMNS = RankField.map((name) => ({
  name,
  label: SORT_LABELS[name],
  labelShort: name === SortOption.ENJOYMENT ? 'Enjoy' : undefined,
  levels: Object.values(RANK_FIELD_ENUMS[name]),
})) satisfies {
  name: RankField
  label: string
  labelShort?: string
  levels: readonly string[]
}[]
