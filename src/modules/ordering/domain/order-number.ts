const ORDER_DAY_TIME_ZONE = 'Asia/Tehran'

/**
 * Calendar day used in `ORD-YYYYMMDD-#####`. Tehran, not the host local TZ,
 * so a late-evening UTC checkout still lands on the Iranian business date.
 */
export function formatOrderDayKey(date: Date, timeZone = ORDER_DAY_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${pick('year')}${pick('month')}${pick('day')}`
}
