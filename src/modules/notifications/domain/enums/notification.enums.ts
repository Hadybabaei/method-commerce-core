export enum NotificationAudience {
  User = 'USER',
  Admin = 'ADMIN',
}

/** Bounded context that produced the notification. */
export enum NotificationContext {
  Identity = 'identity',
  Catalog = 'catalog',
  Basket = 'basket',
  Ordering = 'ordering',
  Comments = 'comments',
  Favorites = 'favorites',
  Addressing = 'addressing',
  System = 'system',
}

export const NOTIFICATION_CONTEXTS = Object.values(NotificationContext)
export const NOTIFICATION_AUDIENCES = Object.values(NotificationAudience)

/** Event names other modules pass as `type`. Grouped by context. */
export const NotificationTypes = {
  ordering: {
    orderCreated: 'order.created',
    orderCancelled: 'order.cancelled',
    orderPaid: 'order.paid',
    orderCompleted: 'order.completed',
  },
} as const
