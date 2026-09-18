import { UnauthenticatedError } from '@shared/domain/errors'
import {
  AccountDisabledError,
  InvalidOtpError,
  OtpExpiredError,
  RefreshTokenMismatchError,
  UserNotFoundError,
} from '../../domain/errors/identity.errors'
import { PhoneNumber } from '../../domain/value-objects/phone-number.vo'
import { createCustomerAuthHarness } from './auth-scenarios.support'

describe('Customer authentication scenarios', () => {
  const phone = '09121234567'

  describe('OTP request', () => {
    it('registers an unknown number and sends a one-time code', async () => {
      const h = createCustomerAuthHarness()

      const result = await h.requestOtp.execute({ phoneNumber: phone })

      expect(result.phoneNumber).toMatch(/\*+/)
      expect(result.code).toBe('12345')
      expect(result.expiresAt.getTime()).toBeGreaterThan(h.clock.now().getTime())
      expect(h.sms.sent).toEqual([{ phoneNumber: '09121234567', code: '12345' }])
      expect(await h.users.existsByPhoneNumber(PhoneNumber.create(phone))).toBe(true)
    })

    it('re-issues a code for an existing account and invalidates the previous one', async () => {
      const h = createCustomerAuthHarness()

      await h.requestOtp.execute({ phoneNumber: phone })
      h.otpGenerator.setNext('67890')
      await h.requestOtp.execute({ phoneNumber: phone })

      await expect(
        h.verifyOtp.execute({ phoneNumber: phone, code: '12345' })
      ).rejects.toBeInstanceOf(InvalidOtpError)

      const session = await h.verifyOtp.execute({ phoneNumber: phone, code: '67890' })
      expect(session.accessToken).toBeDefined()
      expect(session.user.activated).toBe(true)
    })

    it('normalises alternate Iranian phone formats to the same account', async () => {
      const h = createCustomerAuthHarness()

      await h.requestOtp.execute({ phoneNumber: '+989121234567' })
      h.otpGenerator.setNext('11111')
      await h.requestOtp.execute({ phoneNumber: '00989121234567' })

      const session = await h.verifyOtp.execute({ phoneNumber: '09121234567', code: '11111' })
      expect(session.user.phoneNumber).toBe('09121234567')
    })
  })

  describe('OTP verify → session', () => {
    it('exchanges a valid code for access + refresh tokens and activates the account', async () => {
      const h = createCustomerAuthHarness()
      await h.requestOtp.execute({ phoneNumber: phone })

      const session = await h.verifyOtp.execute({ phoneNumber: phone, code: '12345' })

      expect(session.accessToken.startsWith('access.')).toBe(true)
      expect(session.refreshToken.startsWith('refresh.')).toBe(true)
      expect(session.user.activated).toBe(true)
      expect(session.user.id).toBeGreaterThan(0)

      const stored = h.users.peek(session.user.id)
      expect(stored?.refreshToken).toBe(session.refreshToken)
      expect(stored?.otp).toBeNull()
    })

    it('rejects verification when no OTP was requested', async () => {
      const h = createCustomerAuthHarness()

      await expect(
        h.verifyOtp.execute({ phoneNumber: phone, code: '12345' })
      ).rejects.toBeInstanceOf(UserNotFoundError)
    })

    it('rejects a wrong code and leaves the account inactive', async () => {
      const h = createCustomerAuthHarness()
      await h.requestOtp.execute({ phoneNumber: phone })

      await expect(
        h.verifyOtp.execute({ phoneNumber: phone, code: '00000' })
      ).rejects.toBeInstanceOf(InvalidOtpError)

      const user = await h.users.findByPhoneNumber(PhoneNumber.create(phone))
      expect(user?.isActivated).toBe(false)
    })

    it('issues a code that expires after the 2-minute Redis TTL', async () => {
      const h = createCustomerAuthHarness()
      const issuedAt = h.clock.now().getTime()

      const result = await h.requestOtp.execute({ phoneNumber: phone })

      expect(result.expiresAt.getTime()).toBe(issuedAt + 120_000)

      h.clock.advanceSeconds(119)
      const session = await h.verifyOtp.execute({ phoneNumber: phone, code: '12345' })
      expect(session.accessToken).toBeDefined()
    })

    it('rejects an expired Redis OTP after the 2-minute TTL', async () => {
      const h = createCustomerAuthHarness()
      await h.requestOtp.execute({ phoneNumber: phone })
      h.clock.advanceSeconds(120)

      await expect(
        h.verifyOtp.execute({ phoneNumber: phone, code: '12345' })
      ).rejects.toBeInstanceOf(OtpExpiredError)
    })

    it('consumes the code so it cannot be reused', async () => {
      const h = createCustomerAuthHarness()
      await h.requestOtp.execute({ phoneNumber: phone })
      await h.verifyOtp.execute({ phoneNumber: phone, code: '12345' })

      await expect(
        h.verifyOtp.execute({ phoneNumber: phone, code: '12345' })
      ).rejects.toBeInstanceOf(OtpExpiredError)
    })
  })

  describe('Refresh token', () => {
    async function signedIn() {
      const h = createCustomerAuthHarness()
      await h.requestOtp.execute({ phoneNumber: phone })
      const session = await h.verifyOtp.execute({ phoneNumber: phone, code: '12345' })
      return { h, session }
    }

    it('issues a fresh access token from a valid stored refresh token', async () => {
      const { h, session } = await signedIn()

      const refreshed = await h.refresh.execute({ refreshToken: session.refreshToken })

      expect(refreshed.accessToken.startsWith('access.')).toBe(true)
      expect(refreshed.accessToken).not.toBe(session.accessToken)

      const claims = await h.tokens.verify(refreshed.accessToken)
      expect(claims).toMatchObject({
        sub: session.user.id,
        audience: 'user',
        type: 'access',
      })
    })

    it('rejects a cryptographically invalid refresh token', async () => {
      const { h } = await signedIn()

      await expect(h.refresh.execute({ refreshToken: 'not-a-jwt' })).rejects.toBeInstanceOf(
        UnauthenticatedError
      )
    })

    it('rejects an access token presented as a refresh token', async () => {
      const { h, session } = await signedIn()

      await expect(h.refresh.execute({ refreshToken: session.accessToken })).rejects.toBeInstanceOf(
        UnauthenticatedError
      )
    })

    it('rejects a refresh token that no longer matches the one stored on the account', async () => {
      const { h, session } = await signedIn()

      // A second login replaces the stored refresh token.
      h.otpGenerator.setNext('99999')
      await h.requestOtp.execute({ phoneNumber: phone })
      const nextSession = await h.verifyOtp.execute({ phoneNumber: phone, code: '99999' })

      await expect(
        h.refresh.execute({ refreshToken: session.refreshToken })
      ).rejects.toBeInstanceOf(RefreshTokenMismatchError)

      const stillWorks = await h.refresh.execute({ refreshToken: nextSession.refreshToken })
      expect(stillWorks.accessToken).toBeDefined()
    })

    it('rejects refresh after logout', async () => {
      const { h, session } = await signedIn()

      await h.logout.execute({ userId: session.user.id })

      await expect(
        h.refresh.execute({ refreshToken: session.refreshToken })
      ).rejects.toBeInstanceOf(RefreshTokenMismatchError)
    })

    it('rejects refresh for a deactivated account', async () => {
      const { h, session } = await signedIn()
      const user = h.users.peek(session.user.id)!
      user.deactivate()
      await h.users.save(user)

      await expect(
        h.refresh.execute({ refreshToken: session.refreshToken })
      ).rejects.toBeInstanceOf(AccountDisabledError)
    })
  })

  describe('Logout', () => {
    it('clears the stored refresh token while leaving the profile intact', async () => {
      const h = createCustomerAuthHarness()
      await h.requestOtp.execute({ phoneNumber: phone })
      const session = await h.verifyOtp.execute({ phoneNumber: phone, code: '12345' })

      await h.logout.execute({ userId: session.user.id })

      expect(h.users.peek(session.user.id)?.refreshToken).toBeNull()
      const me = await h.getMe.execute(session.user.id)
      expect(me.activated).toBe(true)
      expect(me.phoneNumber).toBe('09121234567')
    })

    it('fails when the user id does not exist', async () => {
      const h = createCustomerAuthHarness()

      await expect(h.logout.execute({ userId: 999 })).rejects.toBeInstanceOf(UserNotFoundError)
    })
  })
})
