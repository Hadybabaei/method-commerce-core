import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { InvalidInputError } from '@shared/domain/errors'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { NotificationAudience, NotificationContext } from '../enums/notification.enums'
import { NotificationIssuedEvent } from '../events/notifications.events'

export interface NotificationProps {
  audience: NotificationAudience
  recipientId: number
  context: NotificationContext
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
  userId: number | null
  adminId: number | null
  readAt: Date | null
  createdAt: Date
}

export interface CreateNotificationInput {
  audience: NotificationAudience
  recipientId: number
  context: NotificationContext
  type: string
  title: string
  body: string
  data?: Record<string, unknown> | null
  now: Date
}

/**
 * One inbox row. The audience + recipient pair is who may read it; context +
 * type say which bounded context produced it.
 */
export class Notification extends AggregateRoot {
  private props: NotificationProps

  private constructor(id: number, props: NotificationProps) {
    super(id)
    this.props = props
  }

  static create(input: CreateNotificationInput): Notification {
    if (!Number.isInteger(input.recipientId) || input.recipientId <= 0) {
      throw new InvalidInputError('A notification needs a recipient')
    }

    const type = input.type.trim()
    const title = input.title.trim()
    const body = input.body.trim()

    if (!type) {
      throw new InvalidInputError('A notification needs a type')
    }
    if (type.length > 80) {
      throw new InvalidInputError('Notification type is too long')
    }
    if (!title) {
      throw new InvalidInputError('A notification needs a title')
    }
    if (title.length > 191) {
      throw new InvalidInputError('Notification title is too long')
    }
    if (!body) {
      throw new InvalidInputError('A notification needs a body')
    }

    const userId = input.audience === NotificationAudience.User ? input.recipientId : null
    const adminId = input.audience === NotificationAudience.Admin ? input.recipientId : null

    return new Notification(UNSAVED_ID, {
      audience: input.audience,
      recipientId: input.recipientId,
      context: input.context,
      type,
      title,
      body,
      data: input.data ?? null,
      userId,
      adminId,
      readAt: null,
      createdAt: input.now,
    })
  }

  static fromPersistence(id: number, props: NotificationProps): Notification {
    return new Notification(id, props)
  }

  markIssued(): void {
    this.addDomainEvent(
      new NotificationIssuedEvent(
        this.id,
        this.props.audience,
        this.props.recipientId,
        this.props.context,
        this.props.type
      )
    )
  }

  markRead(now: Date): void {
    if (this.props.readAt) {
      return
    }
    this.props.readAt = now
  }

  belongsTo(audience: NotificationAudience, recipientId: number): boolean {
    return this.props.audience === audience && this.props.recipientId === recipientId
  }

  get audience(): NotificationAudience {
    return this.props.audience
  }

  get recipientId(): number {
    return this.props.recipientId
  }

  get context(): NotificationContext {
    return this.props.context
  }

  get type(): string {
    return this.props.type
  }

  get title(): string {
    return this.props.title
  }

  get body(): string {
    return this.props.body
  }

  get data(): Record<string, unknown> | null {
    return this.props.data
  }

  get userId(): number | null {
    return this.props.userId
  }

  get adminId(): number | null {
    return this.props.adminId
  }

  get readAt(): Date | null {
    return this.props.readAt
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get isRead(): boolean {
    return this.props.readAt !== null
  }
}
