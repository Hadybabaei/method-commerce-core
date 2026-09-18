export interface OtpSms {
  phoneNumber: string
  code: string
}

export interface SmsSender {
  sendOtp(message: OtpSms): Promise<void>
  send(phoneNumber: string, text: string): Promise<void>
}

export const SMS_SENDER = Symbol('SmsSender')
