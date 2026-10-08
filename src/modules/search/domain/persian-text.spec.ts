import { joinHalfSpaces, normalizePersian, tokenize } from './persian-text'

describe('normalizePersian', () => {
  it.each([
    ['كيف', 'کیف'],
    ['مدل ۲۰۲۶', 'مدل 2026'],
    ['مدل ٢٠٢٦', 'مدل 2026'],
    ['كتابخانه‌ای', 'کتابخانه ای'],
    ['دریـــل', 'دریل'],
    ['مُدِل', 'مدل'],
    ['  Bosch   GSR ', 'bosch gsr'],
    ['أسباب', 'اسباب'],
  ])('%p → %p', (input, expected) => {
    expect(normalizePersian(input)).toBe(expected)
  })

  it('handles empty values', () => {
    expect(normalizePersian(null)).toBe('')
    expect(normalizePersian(undefined)).toBe('')
  })
})

describe('joinHalfSpaces', () => {
  it('removes half-spaces so a word typed joined still matches', () => {
    expect(joinHalfSpaces('می‌خواهم')).toBe('میخواهم')
    expect(joinHalfSpaces('گوشی‌های سامسونگ')).toBe('گوشیهای سامسونگ')
  })
})

describe('tokenize', () => {
  it('splits on punctuation and spaces after normalising', () => {
    expect(tokenize('دریل، شارژی (بوش)')).toEqual(['دریل', 'شارژی', 'بوش'])
    expect(tokenize('   ')).toEqual([])
  })
})
