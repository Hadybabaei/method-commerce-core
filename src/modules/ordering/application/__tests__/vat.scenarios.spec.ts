import { PaymentMethod } from '../../domain/enums/order.enums'
import { OrderNotOwnedError } from '../../domain/errors/ordering.errors'
import { InvoiceNotAvailableError } from '../use-cases/get-invoice.use-case'
import { createCommerceHarness, defaultVariant, phoneFor } from './commerce-scenarios.support'

describe('VAT scenarios', () => {
  const userId = 1

  // Variant 11: 1,000,000 Rial, taxed. Variant 12: 333,333 Rial, exempt.
  function setup(vatRateBp = 1000) {
    const h = createCommerceHarness()
    h.storeSettings.current.vatRateBp = vatRateBp
    h.seedCatalogVariant(defaultVariant(11))
    h.seedCatalogVariant(defaultVariant(12, { unitPrice: 333_333, taxExempt: true }))
    h.seedStock(11, 10)
    h.seedStock(12, 10)
    h.seedUserBasket(userId, [
      { variantId: 11, quantity: 2 },
      { variantId: 12, quantity: 1 },
    ])
    const addressId = h.seedUserAddress(userId)
    return { h, addressId }
  }

  it('adds VAT per taxed line on top of the subtotal and shipping', async () => {
    const { h, addressId } = setup()
    await h.createShippingMethod.execute({ name: 'Post', code: 'post', baseFee: 500_000 })

    const preview = await h.previewCheckout.execute({ userId, addressId })

    expect(preview.taxRateBp).toBe(1000)
    expect(preview.items.map((item) => [item.variantId, item.taxAmount])).toEqual([
      [11, 200_000],
      [12, 0],
    ])
    expect(preview.subtotal).toBe(2_333_333)
    expect(preview.taxTotal).toBe(200_000)
    // Shipping 500,000 + 1 started kg × 0.
    expect(preview.total).toBe(2_333_333 + 500_000 + 200_000)
  })

  it('freezes the rate and line tax on the order and charges the gateway the full total', async () => {
    const { h, addressId } = setup()

    const order = await h.createOrder.execute({
      userId,
      addressId,
      paymentMethod: PaymentMethod.Online,
    })
    h.storeSettings.current.vatRateBp = 2000 // a later change must not touch this order

    const payment = await h.initiatePayment.execute({
      orderId: order.id,
      userId,
      idempotencyKey: 'vat-1',
    })
    const reloaded = await h.getOrder.execute({ orderId: order.id })

    expect(order.taxRateBp).toBe(1000)
    expect(order.taxTotal).toBe(200_000)
    expect(order.total).toBe(2_533_333)
    expect(reloaded.taxTotal).toBe(200_000)
    expect(payment.amount).toBe(2_533_333)
  })

  it('charges no VAT when the rate is 0', async () => {
    const { h, addressId } = setup(0)

    const preview = await h.previewCheckout.execute({ userId, addressId })

    expect(preview.taxTotal).toBe(0)
    expect(preview.total).toBe(preview.subtotal)
  })
})

describe('Invoice scenarios', () => {
  const userId = 1

  async function paidOrder() {
    const h = createCommerceHarness()
    h.storeSettings.current.vatRateBp = 1000
    h.seedCatalogVariant(defaultVariant(11))
    h.seedStock(11, 5)
    h.seedUserBasket(userId, [{ variantId: 11, quantity: 2 }])
    const addressId = h.seedUserAddress(userId)
    const order = await h.createOrder.execute({ userId, addressId })
    return { h, order }
  }

  it('issues an invoice with seller, buyer, VAT per line and totals once paid', async () => {
    const { h, order } = await paidOrder()
    await h.confirmCod.execute({ orderId: order.id })

    const invoice = await h.getInvoice.execute({ orderId: order.id, userId })

    expect(invoice.number).toBe(order.number)
    expect(invoice.seller).toMatchObject({ legalName: 'شرکت متد', economicCode: '411111111111' })
    expect(invoice.buyer).toMatchObject({ phone: phoneFor(userId), postalCode: '1234567890' })
    expect(invoice.buyer.address).toContain('تهران')
    expect(invoice.lines).toEqual([
      expect.objectContaining({
        quantity: 2,
        unitPrice: 1_000_000,
        lineTotal: 2_000_000,
        taxAmount: 200_000,
        total: 2_200_000,
      }),
    ])
    expect(invoice).toMatchObject({ subtotal: 2_000_000, taxTotal: 200_000, total: 2_200_000 })
  })

  it('is not issued before payment', async () => {
    const { h, order } = await paidOrder()
    await expect(h.getInvoice.execute({ orderId: order.id, userId })).rejects.toBeInstanceOf(
      InvoiceNotAvailableError
    )
  })

  it('is only shown to the customer who placed the order', async () => {
    const { h, order } = await paidOrder()
    await h.confirmCod.execute({ orderId: order.id })
    await expect(h.getInvoice.execute({ orderId: order.id, userId: 2 })).rejects.toBeInstanceOf(
      OrderNotOwnedError
    )
    await expect(h.getInvoice.execute({ orderId: order.id })).resolves.toBeDefined()
  })
})
