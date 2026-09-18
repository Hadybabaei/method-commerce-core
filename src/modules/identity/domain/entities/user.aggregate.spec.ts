import {
  AccountDisabledError,
  InvalidOtpError,
  OtpExpiredError,
  OtpNotRequestedError,
  RefreshTokenMismatchError,
} from '../errors/identity.errors'
import { Otp } from '../value-objects/otp.vo'
import { PhoneNumber } from '../value-objects/phone-number.vo'
import { AuthLevel, User } from './user.aggregate'

const NOW = new Date('2026-01-01T10:00:00.000Z')
const LATER = new Date('2026-01-01T10:10:00.000Z')

function newUser(): User {
  return User.register(PhoneNumber.create('09121234567'), NOW)
}

describe('User', () => {
  it('starts unverified and inactive', () => {
    const user = newUser()

    expect(user.isActivated).toBe(false)
    expect(user.authLevel).toBe(AuthLevel.Unverified)
    expect(() => user.ensureActive()).toThrow(AccountDisabledError)
  })

  it('activates the account when the right code is supplied in time', () => {
    const user = newUser()
    user.issueOtp(Otp.create('12345', LATER))

    user.verifyOtp('12345', NOW)

    expect(user.isActivated).toBe(true)
    expect(user.otp).toBeNull()
    expect(() => user.ensureActive()).not.toThrow()
  })

  it('rejects verification when no code was requested', () => {
    expect(() => newUser().verifyOtp('12345', NOW)).toThrow(OtpNotRequestedError)
  })

  it('rejects a wrong code and keeps the account inactive', () => {
    const user = newUser()
    user.issueOtp(Otp.create('12345', LATER))

    expect(() => user.verifyOtp('99999', NOW)).toThrow(InvalidOtpError)
    expect(user.isActivated).toBe(false)
  })

  it('rejects an expired code', () => {
    const user = newUser()
    user.issueOtp(Otp.create('12345', NOW))

    expect(() => user.verifyOtp('12345', LATER)).toThrow(OtpExpiredError)
  })

  it('invalidates the previous code when a new one is requested', () => {
    const user = newUser()
    user.issueOtp(Otp.create('11111', LATER))
    user.issueOtp(Otp.create('22222', LATER))

    expect(() => user.verifyOtp('11111', NOW)).toThrow(InvalidOtpError)
  })

  it('only accepts the refresh token it currently stores', () => {
    const user = newUser()
    user.attachRefreshToken('token-a')

    expect(() => user.ensureRefreshTokenMatches('token-a')).not.toThrow()
    expect(() => user.ensureRefreshTokenMatches('token-b')).toThrow(RefreshTokenMismatchError)

    user.revokeRefreshToken()
    expect(() => user.ensureRefreshTokenMatches('token-a')).toThrow(RefreshTokenMismatchError)
  })

  it('promotes the account to identity-verified once a profile exists', () => {
    const user = newUser()

    user.updateProfile({ firstName: 'Hady', lastName: 'Babaei' })

    expect(user.authLevel).toBe(AuthLevel.IdentityVerified)
    expect(user.profile?.fullName).toBe('Hady Babaei')
  })

  it('activates via confirmPhoneVerified after an external OTP store succeeds', () => {
    const user = newUser()
    user.confirmPhoneVerified(NOW)

    expect(user.isActivated).toBe(true)
    expect(user.otp).toBeNull()
  })

  it('merges later profile updates instead of replacing them', () => {
    const user = newUser()
    user.updateProfile({ firstName: 'Hady' })

    user.updateProfile({ lastName: 'Babaei' })

    expect(user.profile?.firstName).toBe('Hady')
    expect(user.profile?.lastName).toBe('Babaei')
  })
})
