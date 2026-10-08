import { ConfigService } from '@nestjs/config'
import { Clock } from '@shared/application/ports/clock.port'
import { SmsSender } from '@shared/application/ports/sms-sender.port'
import { NotFoundError } from '@shared/domain/errors'
import {
  AlreadyInStockError,
  DueAlert,
  StockAlertNotifier,
  StockAlertsService,
  StockAlertStore,
  stockAlertText,
  VariantForAlert,
} from './stock-alerts'

const clock: Clock = {
  now: () => new Date('2026-10-10T10:00:00Z'),
  secondsFromNow: () => new Date(),
}

const config = {
  getOrThrow: () => ({ frontendUrl: 'https://shop.example/' }),
} as unknown as ConfigService

function variant(overrides: Partial<VariantForAlert> = {}): VariantForAlert {
  return {
    variantId: 5,
    productId: 1,
    title: 'دریل',
    slug: 'دریل-بوش',
    options: [{ option: 'رنگ', value: 'آبی' }],
    sellable: true,
    availableQuantity: 0,
    ...overrides,
  }
}

function fakeStore(due: DueAlert[] = []): jest.Mocked<StockAlertStore> {
  const waiting = new Set(due.map((alert) => alert.alertId))
  return {
    variant: jest.fn(async () => variant()),
    subscribe: jest.fn(async () => undefined),
    unsubscribe: jest.fn(async () => true),
    waiting: jest.fn(async () => []),
    due: jest.fn(async () => due.filter((alert) => waiting.has(alert.alertId))),
    claim: jest.fn(async (id: number) => waiting.delete(id)),
    release: jest.fn(async (id: number) => {
      waiting.add(id)
    }),
    variantsOfProducts: jest.fn(async () => [5, 6]),
  }
}

const alert = (alertId: number): DueAlert => ({
  alertId,
  phoneNumber: `0912000000${alertId}`,
  title: 'دریل',
  slug: 'دریل-بوش',
  options: [{ option: 'رنگ', value: 'آبی' }],
})

describe('StockAlertsService', () => {
  it('waits only for sellable variants that are out of stock', async () => {
    const store = fakeStore()
    const service = new StockAlertsService(store, clock)

    await service.subscribe(3, 5)
    expect(store.subscribe).toHaveBeenCalledWith(3, 5, clock.now())

    store.variant.mockResolvedValueOnce(variant({ availableQuantity: 2 }))
    await expect(service.subscribe(3, 5)).rejects.toThrow(AlreadyInStockError)
    store.variant.mockResolvedValueOnce(variant({ sellable: false }))
    await expect(service.subscribe(3, 5)).rejects.toThrow(NotFoundError)
    store.variant.mockResolvedValueOnce(null)
    await expect(service.subscribe(3, 5)).rejects.toThrow(NotFoundError)
  })

  it('says so when there was nothing to stop', async () => {
    const store = fakeStore()
    store.unsubscribe.mockResolvedValueOnce(false)
    await expect(new StockAlertsService(store, clock).unsubscribe(3, 5)).rejects.toThrow(
      NotFoundError
    )
  })
})

describe('stockAlertText', () => {
  it('names the variant and links the product page', () => {
    expect(stockAlertText(alert(1), 'https://shop.example/')).toBe(
      '«دریل (آبی)» دوباره موجود شد.\nhttps://shop.example/p/%D8%AF%D8%B1%DB%8C%D9%84-%D8%A8%D9%88%D8%B4'
    )
  })
})

describe('StockAlertNotifier', () => {
  it('texts each due alert once, and puts back the ones whose SMS failed', async () => {
    const store = fakeStore([alert(1), alert(2)])
    const sms: jest.Mocked<SmsSender> = {
      sendOtp: jest.fn(),
      send: jest.fn(async (phone: string) => {
        if (phone.endsWith('2')) throw new Error('kavenegar down')
      }),
    }
    const notifier = new StockAlertNotifier(store, sms, clock, config)

    expect(await notifier.notify(null)).toBe(1)
    expect(sms.send).toHaveBeenCalledTimes(2)
    expect(store.release).toHaveBeenCalledWith(2)

    // Next pass retries only the failed one.
    sms.send.mockResolvedValue(undefined)
    expect(await notifier.notify(null)).toBe(1)
    expect(await notifier.notify(null)).toBe(0)
  })

  it('looks only at the variants a catalog change touched', async () => {
    const store = fakeStore()
    const notifier = new StockAlertNotifier(
      store,
      { sendOtp: jest.fn(), send: jest.fn() },
      clock,
      config
    )

    await notifier.onCatalogChanged({ productIds: [1], variantIds: [9], everything: false })
    expect(store.due).toHaveBeenLastCalledWith([9, 5, 6], 200)

    await notifier.onCatalogChanged({ productIds: [], variantIds: [], everything: true })
    expect(store.due).toHaveBeenLastCalledWith(null, 200)

    store.due.mockClear()
    store.variantsOfProducts.mockResolvedValueOnce([])
    await notifier.onCatalogChanged({ productIds: [], variantIds: [], everything: false })
    expect(store.due).not.toHaveBeenCalled()
  })
})
