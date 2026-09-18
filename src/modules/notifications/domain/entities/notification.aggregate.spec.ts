import { Notification } from './notification.aggregate'
import { NotificationAudience, NotificationContext } from '../enums/notification.enums'

describe('Notification', () => {
  const now = new Date('2026-09-18T12:00:00.000Z')

  it('binds a user recipient and stays unread', () => {
    const notification = Notification.create({
      audience: NotificationAudience.User,
      recipientId: 4,
      context: NotificationContext.Ordering,
      type: 'order.created',
      title: 'Order placed',
      body: 'We received your order.',
      now,
    })

    expect(notification.userId).toBe(4)
    expect(notification.adminId).toBeNull()
    expect(notification.isRead).toBe(false)
    expect(notification.belongsTo(NotificationAudience.User, 4)).toBe(true)
    expect(notification.belongsTo(NotificationAudience.Admin, 4)).toBe(false)
  })

  it('marks read once', () => {
    const notification = Notification.create({
      audience: NotificationAudience.Admin,
      recipientId: 7,
      context: NotificationContext.Ordering,
      type: 'order.created',
      title: 'New order',
      body: 'A customer placed an order.',
      now,
    })

    notification.markRead(now)
    notification.markRead(new Date('2026-09-18T13:00:00.000Z'))

    expect(notification.readAt).toEqual(now)
    expect(notification.adminId).toBe(7)
  })
})
