/**
 * Store reports use Tehran calendar days. Iran has had no daylight saving
 * since 2022, so the offset is a fixed +03:30.
 */
export const TEHRAN_OFFSET_MINUTES = 210
export const TEHRAN_OFFSET_SQL = '+03:30'

const DAY_MS = 24 * 60 * 60 * 1000
const OFFSET_MS = TEHRAN_OFFSET_MINUTES * 60 * 1000

/** Start of the Tehran day containing `instant`, as a UTC instant. */
export function startOfTehranDay(instant: Date): Date {
  const local = instant.getTime() + OFFSET_MS
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - OFFSET_MS)
}

/** Start of the Gregorian month (Tehran time) containing `instant`. */
export function startOfTehranMonth(instant: Date): Date {
  const local = new Date(instant.getTime() + OFFSET_MS)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET_MS)
}

/** YYYY-MM-DD of the Tehran day containing `instant`. */
export function tehranDay(instant: Date): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10)
}
