export interface OtpGenerator {
  generate(): string
}

export const OTP_GENERATOR = Symbol('OtpGenerator')
