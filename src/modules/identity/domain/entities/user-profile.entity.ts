import { NumericEntity } from '@shared/domain/entity.base'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { NationalId } from '../value-objects/national-id.vo'

export interface UserProfileProps {
  firstName: string | null
  lastName: string | null
  fatherName: string | null
  nationalId: NationalId | null
  /** ISO `YYYY-MM-DD`; the legacy column is a string. */
  birthDate: string | null
  phone: string | null
  companyName: string | null
  registerCode: number | null
  taxId: number | null
  businessRoleId: number | null
}

export type UserProfileChanges = Partial<UserProfileProps>

const EMPTY_PROFILE: UserProfileProps = {
  firstName: null,
  lastName: null,
  fatherName: null,
  nationalId: null,
  birthDate: null,
  phone: null,
  companyName: null,
  registerCode: null,
  taxId: null,
  businessRoleId: null,
}

/**
 * Personal details of a customer. Part of the `User` aggregate: it is never
 * loaded or saved on its own.
 */
export class UserProfile extends NumericEntity {
  private props: UserProfileProps

  private constructor(id: number, props: UserProfileProps) {
    super(id)
    this.props = props
  }

  static create(changes: UserProfileChanges): UserProfile {
    return new UserProfile(UNSAVED_ID, { ...EMPTY_PROFILE, ...changes })
  }

  static fromPersistence(id: number, props: UserProfileProps): UserProfile {
    return new UserProfile(id, props)
  }

  /** Applies only the keys present in `changes`; `null` clears a field. */
  apply(changes: UserProfileChanges): void {
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) {
        this.props = { ...this.props, [key]: value }
      }
    }
  }

  get firstName(): string | null {
    return this.props.firstName
  }

  get lastName(): string | null {
    return this.props.lastName
  }

  get fullName(): string | null {
    const parts = [this.props.firstName, this.props.lastName].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : null
  }

  get fatherName(): string | null {
    return this.props.fatherName
  }

  get nationalId(): NationalId | null {
    return this.props.nationalId
  }

  get birthDate(): string | null {
    return this.props.birthDate
  }

  get phone(): string | null {
    return this.props.phone
  }

  get companyName(): string | null {
    return this.props.companyName
  }

  get registerCode(): number | null {
    return this.props.registerCode
  }

  get taxId(): number | null {
    return this.props.taxId
  }

  get businessRoleId(): number | null {
    return this.props.businessRoleId
  }

  snapshot(): UserProfileProps {
    return { ...this.props }
  }
}
