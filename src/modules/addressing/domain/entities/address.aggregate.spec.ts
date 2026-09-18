import { InvalidInputError } from '@shared/domain/errors'
import { AddressNotOwnedError } from '../errors/addressing.errors'
import { PostalCode } from '../value-objects/postal-code.vo'
import { Receiver } from '../value-objects/receiver.vo'
import { Address, AddressProps } from './address.aggregate'

const OWNER_ID = 7

function props(overrides: Partial<AddressProps> = {}): AddressProps {
  return {
    userId: OWNER_ID,
    title: 'خانه',
    provinceId: 8,
    cityId: 12,
    hood: 'سعادت آباد',
    postalCode: PostalCode.create('1998745632'),
    pelak: '24',
    vahed: '3',
    details: 'خیابان نهم',
    receiver: Receiver.accountOwner(),
    location: null,
    ...overrides,
  }
}

describe('Address', () => {
  it('rejects a blank required field', () => {
    expect(() => Address.create(props({ hood: '  ' }))).toThrow(InvalidInputError)
    expect(() => Address.create(props({ title: 'x' }))).toThrow(InvalidInputError)
  })

  it('lets only the owner touch it', () => {
    const address = Address.create(props())

    expect(() => address.ensureOwnedBy(OWNER_ID)).not.toThrow()
    expect(() => address.ensureOwnedBy(OWNER_ID + 1)).toThrow(AddressNotOwnedError)
  })

  it('applies a partial update without clearing untouched fields', () => {
    const address = Address.create(props())

    address.apply({ title: 'محل کار' })

    expect(address.title).toBe('محل کار')
    expect(address.hood).toBe('سعادت آباد')
  })

  it('validates fields that a partial update does touch', () => {
    const address = Address.create(props())

    expect(() => address.apply({ details: '' })).toThrow(InvalidInputError)
  })
})

describe('Receiver', () => {
  it('needs no contact details when the account holder receives the order', () => {
    const receiver = Receiver.accountOwner()

    expect(receiver.isAccountOwner).toBe(true)
    expect(receiver.fullName).toBeNull()
    expect(receiver.phoneNumber).toBeNull()
  })

  it('requires a name and a valid mobile number for a third party', () => {
    expect(() => Receiver.thirdParty('', '09121234567')).toThrow(InvalidInputError)
    expect(() => Receiver.thirdParty('Ali Rezaei', '0812345678')).toThrow(InvalidInputError)
  })

  it('normalises a third-party phone number', () => {
    expect(Receiver.thirdParty('Ali Rezaei', '+989121234567').phoneNumber).toBe('09121234567')
  })
})

describe('PostalCode', () => {
  it('strips separators and Persian digits', () => {
    expect(PostalCode.create('۱۹۹۸۷-۴۵۶۳۲').value).toBe('1998745632')
  })

  it('rejects anything that is not ten digits', () => {
    expect(() => PostalCode.create('12345')).toThrow(InvalidInputError)
  })
})
