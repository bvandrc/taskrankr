/**
 * @fileoverview Defines tailwind color and style mappings for task rank fields
 * (priority, ease, enjoyment, time).
 */

import {
  Ease,
  Enjoyment,
  Priority,
  type RankField,
  Time,
} from '~/shared/schema'
import type { RankFieldValueMap } from './constants'

const STYLES_COMMON = {
  red: 'text-red-400 bg-red-400/10 border-red-500/20',
  yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  green: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  red_bold: 'text-red-700 bg-red-400/10 border-red-500/20',
  green_bold: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
  green_dull: 'text-emerald-600/60 bg-emerald-600/5 border-emerald-600/10',
  red_dull: 'text-red-400/60 bg-red-400/10 border-red-500/60',
  none: '',
}

const RANK_FIELD_STYLES = {
  priority: {
    [Priority.HIGHEST]: STYLES_COMMON.red_bold,
    [Priority.HIGH]: STYLES_COMMON.red,
    [Priority.MEDIUM]: STYLES_COMMON.yellow,
    [Priority.LOW]: STYLES_COMMON.green,
    [Priority.LOWEST]: STYLES_COMMON.green_dull,
  },
  ease: {
    [Ease.HARDEST]: STYLES_COMMON.red_dull,
    [Ease.HARD]: STYLES_COMMON.red,
    [Ease.MEDIUM]: STYLES_COMMON.yellow,
    [Ease.EASY]: STYLES_COMMON.green,
    [Ease.EASIEST]: STYLES_COMMON.green_bold,
  },
  enjoyment: {
    [Enjoyment.LOWEST]: STYLES_COMMON.red_dull,
    [Enjoyment.LOW]: STYLES_COMMON.red,
    [Enjoyment.MEDIUM]: STYLES_COMMON.yellow,
    [Enjoyment.HIGH]: STYLES_COMMON.green,
    [Enjoyment.HIGHEST]: STYLES_COMMON.green_bold,
  },
  time: {
    [Time.HIGHEST]: STYLES_COMMON.red_dull,
    [Time.HIGH]: STYLES_COMMON.red,
    [Time.MEDIUM]: STYLES_COMMON.yellow,
    [Time.LOW]: STYLES_COMMON.green,
    [Time.LOWEST]: STYLES_COMMON.green_bold,
  },
} as const satisfies {
  [F in RankField]: Record<RankFieldValueMap[F], string>
}

export const getRankFieldStyle = <
  Field extends RankField,
  Value extends RankFieldValueMap[Field],
>(
  field: Field,
  value: Value | null | undefined,
  defaultStyle = 'text-slate-400 text-muted-foreground italic',
): string => {
  const styles = RANK_FIELD_STYLES[field] as Record<Value, string>
  if (!styles || !value) return defaultStyle
  return styles[value] ?? defaultStyle
}
