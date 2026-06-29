/** @fileoverview Display labels and column metadata for sort/rank fields. */

import { RankField, RankFields } from '~/shared/schema'
import { RANK_FIELD_ENUMS } from './constants'

export const SORT_LABELS = {
  [RankField.PRIORITY]: 'Priority',
  [RankField.EASE]: 'Ease',
  [RankField.ENJOYMENT]: 'Enjoyment',
  [RankField.TIME]: 'Time',
} as const satisfies Record<RankField, string>

/** Rank-field column metadata in display order (name, label, enum values). */
export const RANK_FIELDS_COLUMNS = RankFields.map((name) => ({
  name,
  label: SORT_LABELS[name],
  labelShort: name === RankField.ENJOYMENT ? 'Enjoy' : undefined,
  levels: Object.values(RANK_FIELD_ENUMS[name]),
})) satisfies {
  name: RankField
  label: string
  labelShort?: string
  levels: readonly string[]
}[]
