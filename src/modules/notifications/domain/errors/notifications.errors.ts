import { NotFoundError } from '@shared/domain/errors'

export class NotificationNotFoundError extends NotFoundError {
  constructor(id?: number) {
    super(
      'Notification not found',
      id === undefined ? undefined : { notification: id }
    )
  }
}
