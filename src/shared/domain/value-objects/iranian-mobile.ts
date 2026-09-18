const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const IRANIAN_MOBILE = /^09\d{9}$/

/** Rewrites Persian and Arabic-Indic digits as ASCII. */
export function toLatinDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
}

/**
 * Canonicalises an Iranian mobile number to `09xxxxxxxxx`, accepting the
 * `+98`, `0098`, `98` and bare `9xxxxxxxxx` variants. Returns `null` when the
 * input cannot be a mobile number.
 *
 * Shared kernel: both the identity and addressing contexts need this exact
 * rule, so it lives here instead of being duplicated per context.
 */
export function normalizeIranianMobile(raw: string): string | null {
  if (typeof raw !== 'string') return null

  const digitsOnly = toLatinDigits(raw).replace(/\D/g, '')

  let normalized = digitsOnly
  if (digitsOnly.startsWith('0098')) normalized = `0${digitsOnly.slice(4)}`
  else if (digitsOnly.startsWith('98') && digitsOnly.length === 12)
    normalized = `0${digitsOnly.slice(2)}`
  else if (digitsOnly.startsWith('9') && digitsOnly.length === 10) normalized = `0${digitsOnly}`

  return IRANIAN_MOBILE.test(normalized) ? normalized : null
}
