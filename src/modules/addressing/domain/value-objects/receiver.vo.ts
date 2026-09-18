import { InvalidInputError } from '@shared/domain/errors'
import { normalizeIranianMobile } from '@shared/domain/value-objects/iranian-mobile'
import { ValueObject } from '@shared/domain/value-object.base'

interface ReceiverProps {
  isAccountOwner: boolean
  fullName: string | null
  phoneNumber: string | null
}

/**
 * Who takes delivery at an address. Modelled as a value object because the
 * three columns behind it are only meaningful together: a third-party receiver
 * must have both a name and a reachable phone number.
 */
export class Receiver extends ValueObject<ReceiverProps> {
  private constructor(props: ReceiverProps) {
    super(props)
  }

  static accountOwner(): Receiver {
    return new Receiver({ isAccountOwner: true, fullName: null, phoneNumber: null })
  }

  static thirdParty(fullName: string, phoneNumber: string): Receiver {
    const name = (fullName ?? '').trim()

    if (name.length < 3) {
      throw new InvalidInputError('Receiver full name is required when receiving on your behalf')
    }

    const normalizedPhone = normalizeIranianMobile(phoneNumber ?? '')

    if (!normalizedPhone) {
      throw new InvalidInputError('Receiver phone number must be a valid Iranian mobile number')
    }

    return new Receiver({ isAccountOwner: false, fullName: name, phoneNumber: normalizedPhone })
  }

  static fromPersistence(props: ReceiverProps): Receiver {
    return new Receiver(props)
  }

  get isAccountOwner(): boolean {
    return this.props.isAccountOwner
  }

  get fullName(): string | null {
    return this.props.fullName
  }

  get phoneNumber(): string | null {
    return this.props.phoneNumber
  }
}
