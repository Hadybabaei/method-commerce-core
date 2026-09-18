import { AdminRole } from '../../domain/enums/roles.enum'

export interface RequestOtpCommand {
  phoneNumber: string
}

export interface VerifyOtpCommand {
  phoneNumber: string
  code: string
}

export interface RefreshAccessTokenCommand {
  refreshToken: string
}

export interface LogoutCommand {
  userId: number
}

export interface UpdateUserInfoCommand {
  userId: number
  email?: string | null
  avatar?: string | null
  firstName?: string | null
  lastName?: string | null
  fatherName?: string | null
  nationalId?: string | null
  birthDate?: string | null
  phone?: string | null
  companyName?: string | null
}

export interface AdminLoginCommand {
  email: string
  password: string
}

export interface RequestAdminPasswordResetCommand {
  email: string
}

export interface ResetAdminPasswordCommand {
  email: string
  token: string
  newPassword: string
}

export interface ChangeAdminPasswordCommand {
  adminId: number
  currentPassword: string
  newPassword: string
}

export interface CreateAdminCommand {
  email: string
  password: string
  role: AdminRole
  firstName?: string | null
  lastName?: string | null
  nationalId?: string | null
  address?: string | null
  phoneNumber?: string | null
}
