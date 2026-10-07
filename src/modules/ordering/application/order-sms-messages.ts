const toman = (rial: number) => Math.floor(rial / 10).toLocaleString('fa-IR')

type SmsOrder = {
  number: string
  total: { amount: number }
  trackingCode: string | null
  trackingUrl: string | null
}

/** Persian customer texts for each order status. */
export const orderSmsMessages = {
  created: (order: SmsOrder) =>
    `سفارش ${order.number} ثبت شد.\nمبلغ قابل پرداخت: ${toman(order.total.amount)} تومان`,

  paid: (order: SmsOrder) =>
    `پرداخت سفارش ${order.number} تأیید شد. سفارش شما به‌زودی آماده می‌شود.`,

  processing: (order: SmsOrder) => `سفارش ${order.number} در حال آماده‌سازی است.`,

  shipped: (order: SmsOrder) =>
    [
      `سفارش ${order.number} ارسال شد.`,
      order.trackingCode ? `کد رهگیری: ${order.trackingCode}` : null,
      order.trackingUrl,
    ]
      .filter(Boolean)
      .join('\n'),

  completed: (order: SmsOrder) => `سفارش ${order.number} تحویل شد. از خرید شما سپاسگزاریم.`,

  cancelled: (order: SmsOrder) => `سفارش ${order.number} لغو شد.`,
}
