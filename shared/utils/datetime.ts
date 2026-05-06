import { hoursToMilliseconds, intervalToDuration } from 'date-fns'

export function formatDaysSince(date: Date): string {
  const days = Math.floor(
    (Date.now() - date.getTime()) / hoursToMilliseconds(24),
  )
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export function formatDuration(ms: number) {
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
