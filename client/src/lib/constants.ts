/**
 * @fileoverview Application-wide constants and configuration values
 */

import type { ValueOf } from 'type-fest'

import { Ease, Enjoyment, Priority, RankField, Time } from '~/shared/schema'

export const STANDARD_DATE_FORMAT = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
} as const satisfies Intl.DateTimeFormatOptions

export const Routes = {
  HOME: '/',
  GUEST: '/guest',
  SETTINGS: '/settings',
  HOW_TO_USE: '/how-to-use',
  HOW_TO_INSTALL: '/how-to-install',
  COMPLETED: '/completed',
  PRIVACY_POLICY: '/privacy-policy',
  DELETE_ACCOUNT: '/account/delete',
} as const

export const RANK_FIELD_ENUMS = {
  [RankField.PRIORITY]: Priority,
  [RankField.EASE]: Ease,
  [RankField.ENJOYMENT]: Enjoyment,
  [RankField.TIME]: Time,
} as const satisfies Record<RankField, Record<string, string>>

export type RankFieldValueMap = {
  [K in RankField]: ValueOf<(typeof RANK_FIELD_ENUMS)[K]>
}
