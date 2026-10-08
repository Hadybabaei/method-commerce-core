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

  returnApproved: (order: SmsOrder) =>
    `درخواست مرجوعی سفارش ${order.number} تأیید شد. لطفاً کالا را برای ما ارسال کنید.`,

  returnRejected: (order: SmsOrder, note: string | null) =>
    [`درخواست مرجوعی سفارش ${order.number} رد شد.`, note ? `علت: ${note}` : null]
      .filter(Boolean)
      .join('\n'),

  refundPaid: (order: SmsOrder, amount: number, reference: string) =>
    `مبلغ ${toman(amount)} تومان بابت سفارش ${order.number} به حساب شما واریز شد.\nشماره پیگیری: ${reference}`,
}
