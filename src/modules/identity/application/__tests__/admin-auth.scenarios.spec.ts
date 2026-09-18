import { UnauthenticatedError } from '@shared/domain/errors'
import {
  AccountDisabledError,
  InvalidCredentialsError,
  InvalidPasswordResetTokenError,
  PasswordResetNotRequestedError,
  PasswordResetTokenExpiredError,
  SamePasswordError,
} from '../../domain/errors/identity.errors'
import { createAdminAuthHarness, createCustomerAuthHarness } from './auth-scenarios.support'

describe('Admin authentication scenarios', () => {
  const email = 'admin@method-commerce.test'
  const password = 'Secret123'

  describe('Login', () => {
    it('returns an admin-audience access token for valid credentials', async () => {
      const h = createAdminAuthHarness()
      const admin = await h.seedAdmin({ email, password })

      const session = await h.login.execute({ email, password })

      expect(session.admin.id).toBe(admin.id)
      expect(session.admin.email).toBe(email)
      expect(session.accessToken.startsWith('access.')).toBe(true)

      const claims = await h.tokens.verify(session.accessToken)
      expect(claims).toMatchObject({
        sub: admin.id,
        audience: 'admin',
        type: 'access',
        email,
      })
    })

    it('rejects an unknown email with the same error as a wrong password', async () => {
      const h = createAdminAuthHarness()
      await h.seedAdmin({ email, password })

      await expect(
        h.login.execute({ email: 'nobody@method-commerce.test', password })
      ).rejects.toBeInstanceOf(InvalidCredentialsError)

      await expect(h.login.execute({ email, password: 'WrongPass1' })).rejects.toBeInstanceOf(
        InvalidCredentialsError
      )
    })

    it('rejects a disabled account after the password checks out', async () => {
      const h = createAdminAuthHarness()
      await h.seedAdmin({ email, password, active: false })

      await expect(h.login.execute({ email, password })).rejects.toBeInstanceOf(AccountDisabledError)
    })
  })

  describe('Forgot / reset password', () => {
    it('emails a reset token for a known account without revealing success differently for unknown emails', async () => {
      const h = createAdminAuthHarness()
      await h.seedAdmin({ email, password })

      await expect(h.forgotPassword.execute({ email })).resolves.toBeUndefined()
      await expect(
        h.forgotPassword.execute({ email: 'ghost@method-commerce.test' })
      ).resolves.toBeUndefined()

      expect(h.mail.sent).toHaveLength(1)
      expect(h.mail.sent[0].to).toBe(email)
      expect(h.mail.sent[0].text).toContain('RESET1')
    })

    it('replaces the password with a valid reset token and clears the token', async () => {
      const h = createAdminAuthHarness()
      const admin = await h.seedAdmin({ email, password })
      await h.forgotPassword.execute({ email })

      await h.resetPassword.execute({
        email,
        token: 'RESET1',
        newPassword: 'NewSecret9',
      })

      expect(h.admins.peek(admin.id)?.passwordReset).toBeNull()

      await expect(h.login.execute({ email, password })).rejects.toBeInstanceOf(
        InvalidCredentialsError
      )

      const session = await h.login.execute({ email, password: 'NewSecret9' })
      expect(session.admin.id).toBe(admin.id)
    })

    it('rejects reset when no token was requested', async () => {
      const h = createAdminAuthHarness()
      await h.seedAdmin({ email, password })

      await expect(
        h.resetPassword.execute({ email, token: 'RESET1', newPassword: 'NewSecret9' })
      ).rejects.toBeInstanceOf(PasswordResetNotRequestedError)
    })

    it('rejects an incorrect reset token', async () => {
      const h = createAdminAuthHarness()
      await h.seedAdmin({ email, password })
      await h.forgotPassword.execute({ email })

      await expect(
        h.resetPassword.execute({ email, token: 'WRONG1', newPassword: 'NewSecret9' })
      ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError)
    })

    it('rejects an expired reset token', async () => {
      const h = createAdminAuthHarness()
      await h.seedAdmin({ email, password })
      await h.forgotPassword.execute({ email })
      h.clock.advanceSeconds(901)

      await expect(
        h.resetPassword.execute({ email, token: 'RESET1', newPassword: 'NewSecret9' })
      ).rejects.toBeInstanceOf(PasswordResetTokenExpiredError)
    })

    it('rejects replaying a consumed reset token', async () => {
      const h = createAdminAuthHarness()
      await h.seedAdmin({ email, password })
      await h.forgotPassword.execute({ email })
      await h.resetPassword.execute({
        email,
        token: 'RESET1',
        newPassword: 'NewSecret9',
      })

      await expect(
        h.resetPassword.execute({ email, token: 'RESET1', newPassword: 'Another1a' })
      ).rejects.toBeInstanceOf(PasswordResetNotRequestedError)
    })
  })

  describe('Change password (authenticated)', () => {
    it('updates the password when the current one is correct', async () => {
      const h = createAdminAuthHarness()
      const admin = await h.seedAdmin({ email, password })

      await h.changePassword.execute({
        adminId: admin.id,
        currentPassword: password,
        newPassword: 'Changed99',
      })

      await expect(h.login.execute({ email, password })).rejects.toBeInstanceOf(
        InvalidCredentialsError
      )
      await expect(h.login.execute({ email, password: 'Changed99' })).resolves.toMatchObject({
        admin: { id: admin.id },
      })
    })

    it('rejects when the current password is wrong', async () => {
      const h = createAdminAuthHarness()
      const admin = await h.seedAdmin({ email, password })

      await expect(
        h.changePassword.execute({
          adminId: admin.id,
          currentPassword: 'WrongPass1',
          newPassword: 'Changed99',
        })
      ).rejects.toBeInstanceOf(InvalidCredentialsError)
    })

    it('rejects when the new password equals the current one', async () => {
      const h = createAdminAuthHarness()
      const admin = await h.seedAdmin({ email, password })

      await expect(
        h.changePassword.execute({
          adminId: admin.id,
          currentPassword: password,
          newPassword: password,
        })
      ).rejects.toBeInstanceOf(SamePasswordError)
    })
  })

  describe('Token audience boundary', () => {
    it('signs admin tokens that a customer refresh flow would reject', async () => {
      const h = createAdminAuthHarness()
      await h.seedAdmin({ email, password })
      await h.login.execute({ email, password })

      // Admin login only issues access tokens; forging a refresh with admin audience
      // still must fail the customer refresh use case's audience check.
      const forgedRefresh = await h.tokens.signRefreshToken({
        sub: 1,
        role: 'admin',
        audience: 'admin',
        email,
      })

      const customer = createCustomerAuthHarness()

      await expect(
        customer.refresh.execute({ refreshToken: forgedRefresh })
      ).rejects.toBeInstanceOf(UnauthenticatedError)
    })
  })
})
