export interface UserView {
  id: number
  phoneNumber: string
  email: string | null
  role: string
  type: string
  authLevel: number
  activated: boolean
  avatar: string | null
  firstName: string | null
  lastName: string | null
  fatherName: string | null
  nationalId: string | null
  birthDate: string | null
  phone: string | null
  companyName: string | null
  createdAt: Date
}

export interface AdminView {
  id: number
  email: string
  role: string
  active: boolean
  firstName: string | null
  lastName: string | null
  nationalId: string | null
  address: string | null
  avatarUrl: string | null
  phoneNumber: string | null
  createdAt: Date
}

export interface OtpRequestedView {
  /** Masked so the response never echoes a full phone number. */
  phoneNumber: string
  expiresAt: Date
  /** Development convenience; omitted unless `OTP_EXPOSE_IN_RESPONSE` is on. */
  code?: string
}

export interface AuthenticatedUserView {
  accessToken: string
  refreshToken: string
  user: UserView
}

export interface AuthenticatedAdminView {
  accessToken: string
  admin: AdminView
}

export interface AccessTokenView {
  accessToken: string
}
