/** Quotes a CSV field when it contains a comma, quote or line break (RFC 4180). */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  const text = value instanceof Date ? value.toISOString() : String(value)
  // Text starting with =, +, - or @ would run as a spreadsheet formula.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * CSV with a UTF-8 byte order mark so Excel shows Persian text correctly.
 * Numbers stay raw; money columns are Rial.
 */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvField).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}
