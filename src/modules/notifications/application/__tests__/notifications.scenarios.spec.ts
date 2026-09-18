import {
  NotificationAudience,
  NotificationContext,
  NotificationTypes,
} from '../../domain/enums/notification.enums'
import { NotificationNotFoundError } from '../../domain/errors/notifications.errors'
import { createNotificationsHarness } from './notifications-scenarios.support'

describe('Notification scenarios', () => {
  it('fans out an ordering event to the customer and every active admin', async () => {
    const h = createNotificationsHarness([7, 8])

    await h.send.sendNotification({
      context: NotificationContext.Ordering,
      type: NotificationTypes.ordering.orderCreated,
      title: 'Order placed',
      body: 'We received your order.',
      data: { orderId: 9, number: 'ORD-20260918-00001' },
      recipients: [
        {
          audience: 'user',
          userId: 4,
          title: 'Order ORD-20260918-00001 placed',
          body: 'We received your order ORD-20260918-00001.',
        },
        {
          audience: 'admin',
          allAdmins: true,
          title: 'New order ORD-20260918-00001',
          body: 'Customer 4 placed ORD-20260918-00001.',
        },
      ],
    })

    const customer = await h.list.execute({
      audience: NotificationAudience.User,
      recipientId: 4,
    })
    const admin = await h.list.execute({
      audience: NotificationAudience.Admin,
      recipientId: 7,
    })
    const otherAdmin = await h.list.execute({
      audience: NotificationAudience.Admin,
      recipientId: 8,
    })

    expect(customer.total).toBe(1)
    expect(customer.unreadCount).toBe(1)
    expect(customer.items[0]).toMatchObject({
      context: NotificationContext.Ordering,
      type: 'order.created',
      title: 'Order ORD-20260918-00001 placed',
      audience: NotificationAudience.User,
      recipientId: 4,
    })

    expect(admin.total).toBe(1)
    expect(admin.items[0].title).toBe('New order ORD-20260918-00001')
    expect(otherAdmin.total).toBe(1)
    expect(h.store.byId.size).toBe(3)
  })

  it('keeps customer and admin inboxes isolated', async () => {
    const h = createNotificationsHarness([7])

    await h.send.sendNotification({
      context: NotificationContext.Ordering,
      type: NotificationTypes.ordering.orderCreated,
      title: 'shared',
      body: 'shared',
      recipients: [
        { audience: 'user', userId: 4 },
        { audience: 'admin', adminId: 7 },
      ],
    })

    const customer = await h.list.execute({
      audience: NotificationAudience.User,
      recipientId: 4,
    })
    expect(customer.items).toHaveLength(1)

    await expect(
      h.markRead.execute({
        notificationId: customer.items[0].id,
        audience: NotificationAudience.Admin,
        recipientId: 7,
      })
    ).rejects.toBeInstanceOf(NotificationNotFoundError)
  })

  it('marks one row read and then the rest of the inbox', async () => {
    const h = createNotificationsHarness([])

    await h.send.sendNotification({
      context: NotificationContext.Ordering,
      type: NotificationTypes.ordering.orderCreated,
      title: 'first',
      body: 'first',
      recipients: [{ audience: 'user', userId: 4 }],
    })
    await h.send.sendNotification({
      context: NotificationContext.Ordering,
      type: NotificationTypes.ordering.orderPaid,
      title: 'second',
      body: 'second',
      recipients: [{ audience: 'user', userId: 4 }],
    })

    const listed = await h.list.execute({
      audience: NotificationAudience.User,
      recipientId: 4,
    })
    expect(listed.unreadCount).toBe(2)

    const read = await h.markRead.execute({
      notificationId: listed.items[0].id,
      audience: NotificationAudience.User,
      recipientId: 4,
    })
    expect(read.readAt).toEqual(h.clock.now())

    const afterOne = await h.list.execute({
      audience: NotificationAudience.User,
      recipientId: 4,
      unreadOnly: true,
    })
    expect(afterOne.total).toBe(1)
    expect(afterOne.unreadCount).toBe(1)

    const all = await h.markAll.execute({
      audience: NotificationAudience.User,
      recipientId: 4,
    })
    expect(all.marked).toBe(1)

    const empty = await h.list.execute({
      audience: NotificationAudience.User,
      recipientId: 4,
      unreadOnly: true,
    })
    expect(empty.total).toBe(0)
    expect(empty.unreadCount).toBe(0)
  })

  it('filters the inbox by producing context', async () => {
    const h = createNotificationsHarness([])

    await h.send.sendNotification({
      context: NotificationContext.Ordering,
      type: NotificationTypes.ordering.orderCreated,
      title: 'order',
      body: 'order',
      recipients: [{ audience: 'user', userId: 4 }],
    })
    await h.send.sendNotification({
      context: NotificationContext.Identity,
      type: 'account.activated',
      title: 'welcome',
      body: 'welcome',
      recipients: [{ audience: 'user', userId: 4 }],
    })

    const ordering = await h.list.execute({
      audience: NotificationAudience.User,
      recipientId: 4,
      context: NotificationContext.Ordering,
    })
    expect(ordering.total).toBe(1)
    expect(ordering.items[0].type).toBe('order.created')
    expect(ordering.unreadCount).toBe(2)
  })
})
