export enum RankField {
  PRIORITY = 'priority',
  EASE = 'ease',
  ENJOYMENT = 'enjoyment',
  TIME = 'time',
}

/** Rank field enum in order of appearance */
export const RankFields = [
  RankField.PRIORITY,
  RankField.EASE,
  RankField.ENJOYMENT,
  RankField.TIME,
] as const
