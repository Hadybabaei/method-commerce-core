import { Receiver } from '../../domain/value-objects/receiver.vo'

/**
 * Builds the `Receiver` value object from the flat request fields, letting the
 * value object itself decide what a third-party receiver must provide.
 *
 * Returns `undefined` when the caller did not mention the receiver at all, so
 * partial updates can leave it untouched.
 */
export function toReceiver(
  ownReceiver: boolean | undefined,
  fullName: string | null | undefined,
  phoneNumber: string | null | undefined
): Receiver | undefined {
  if (ownReceiver === undefined) {
    return undefined
  }

  return ownReceiver
    ? Receiver.accountOwner()
    : Receiver.thirdParty(fullName ?? '', phoneNumber ?? '')
}
