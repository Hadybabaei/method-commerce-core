/**
 * Resolves which back-office accounts receive an `allAdmins` fan-out.
 * Implemented against identity so notifications never loads Admin internals.
 */
export interface AdminRecipientDirectory {
  listActiveIds(): Promise<number[]>
}

export const ADMIN_RECIPIENT_DIRECTORY = Symbol('AdminRecipientDirectory')
