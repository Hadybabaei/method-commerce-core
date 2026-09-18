/**
 * Auto-increment identifiers are assigned by the database, so an aggregate that
 * has not been persisted yet carries this sentinel instead of a real id.
 */
export const UNSAVED_ID = 0

export function isUnsaved(id: number): boolean {
  return id === UNSAVED_ID
}
