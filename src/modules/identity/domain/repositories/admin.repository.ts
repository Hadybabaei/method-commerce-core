import { Admin } from '../entities/admin.aggregate'
import { EmailAddress } from '../value-objects/email-address.vo'

export interface AdminRepository {
  findById(id: number): Promise<Admin | null>

  findByEmail(email: EmailAddress): Promise<Admin | null>

  findAll(): Promise<Admin[]>

  /** Inserts when the aggregate is new, updates otherwise. */
  save(admin: Admin): Promise<Admin>

  delete(id: number): Promise<void>
}

export const ADMIN_REPOSITORY = Symbol('AdminRepository')
