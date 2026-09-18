import { InvalidInputError } from '@shared/domain/errors'
import { PhoneNumber } from './phone-number.vo'

describe('PhoneNumber', () => {
  it.each([
    ['09121234567', '09121234567'],
    ['+989121234567', '09121234567'],
    ['00989121234567', '09121234567'],
    ['9121234567', '09121234567'],
    ['0912 123 4567', '09121234567'],
    ['۰۹۱۲۱۲۳۴۵۶۷', '09121234567'],
  ])('normalises %s to %s', (input, expected) => {
    expect(PhoneNumber.create(input).value).toBe(expected)
  })

  it.each(['', '0812345678', '0912123456', '091212345678', 'not-a-phone'])(
    'rejects %s',
    (input) => {
      expect(() => PhoneNumber.create(input)).toThrow(InvalidInputError)
    }
  )

  it('masks the middle digits', () => {
    expect(PhoneNumber.create('09121234567').masked).toBe('0912***4567')
  })

  it('treats numbers written differently as the same value', () => {
    expect(PhoneNumber.create('+989121234567').equals(PhoneNumber.create('09121234567'))).toBe(true)
  })
})
