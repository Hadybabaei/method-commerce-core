/**
 * Persian text as people type it varies in ways a search engine treats as
 * different words: Arabic ي/ك instead of Persian ی/ک, a half-space (ZWNJ) or
 * a space or nothing between parts of one word, diacritics, Persian or Arabic
 * digits, and the tatweel used to stretch letters. Both the index and every
 * query pass through the same normalisation, so they meet in the middle.
 */

const ZWNJ = /[‌‍‏‎]/g
const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g
const TATWEEL = /ـ/g

const LETTERS: Record<string, string> = {
  ي: 'ی',
  ى: 'ی',
  ئ: 'ی',
  ك: 'ک',
  ة: 'ه',
  ۀ: 'ه',
  أ: 'ا',
  إ: 'ا',
  ٱ: 'ا',
  ؤ: 'و',
}

function foldChar(char: string): string {
  const code = char.charCodeAt(0)
  // Persian (۰-۹) and Arabic-Indic (٠-٩) digits become ASCII.
  if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0)
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660)
  return LETTERS[char] ?? char
}

function fold(text: string): string {
  return text
    .normalize('NFC')
    .replace(DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/./gu, foldChar)
    .toLowerCase()
}

const squash = (text: string) => text.replace(/[\s ]+/g, ' ').trim()

/** Searchable form: half-spaces become spaces ("می‌خواهم" → "می خواهم"). */
export function normalizePersian(text: string | null | undefined): string {
  if (!text) return ''
  return squash(fold(text).replace(ZWNJ, ' '))
}

/** Joined form: half-spaces vanish ("می‌خواهم" → "میخواهم"), for people who type it joined. */
export function joinHalfSpaces(text: string | null | undefined): string {
  if (!text) return ''
  return squash(fold(text).replace(ZWNJ, ''))
}

/** Words of a normalised query, without punctuation. */
export function tokenize(text: string): string[] {
  return normalizePersian(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}
