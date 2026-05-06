import { intervalToDuration } from 'date-fns'

export const formatDuration = (ms: number) => {
  if (ms <= 0) return null
  const {
    hours = 0,
    minutes = 0,
    seconds = 0,
  } = intervalToDuration({ start: 0, end: ms })
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}
