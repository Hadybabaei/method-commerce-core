import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
import { AppConfig } from '@config/app.config'
import { CATALOG_CHANGED, CatalogChange } from '@modules/catalog/domain/events/catalog-changed'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { SMS_SENDER, SmsSender } from '@shared/application/ports/sms-sender.port'
import { BusinessRuleViolationError, NotFoundError } from '@shared/domain/errors'

export interface VariantForAlert {
  variantId: number
  productId: number
  title: string
  slug: string
  options: { option: string; value: string }[]
  /** Active variant of a published product. */
  sellable: boolean
  availableQuantity: number
}

export interface StockAlertView {
  variantId: number
  productId: number
  title: string
  slug: string
  options: { option: string; value: string }[]
  createdAt: Date
}

/** A waiting alert whose variant can be bought again. */
export interface DueAlert {
  alertId: number
  phoneNumber: string
  title: string
  slug: string
  options: { option: string; value: string }[]
}

export interface StockAlertStore {
  variant(variantId: number): Promise<VariantForAlert | null>
  /** Starts (or restarts, after a sent alert) waiting for this variant. */
  subscribe(userId: number, variantId: number, now: Date): Promise<void>
  unsubscribe(userId: number, variantId: number): Promise<boolean>
  /** Alerts still waiting, newest first. */
  waiting(userId: number): Promise<StockAlertView[]>
  /** Waiting alerts whose variant is sellable with units available; optionally only these variants. */
  due(variantIds: number[] | null, limit: number): Promise<DueAlert[]>
  /** Marks an alert sent; false when another worker got there first. */
  claim(alertId: number, now: Date): Promise<boolean>
  /** Puts a claimed alert back after the SMS failed. */
  release(alertId: number): Promise<void>
  variantsOfProducts(productIds: number[]): Promise<number[]>
}

export const STOCK_ALERT_STORE = Symbol('StockAlertStore')

export class AlreadyInStockError extends BusinessRuleViolationError {
  constructor(variantId: number) {
    super('This item can already be bought', { variant: variantId })
  }
}

export function stockAlertText(alert: DueAlert, storefrontUrl: string): string {
  const options = alert.options.map((option) => option.value).join('، ')
  const name = options ? `${alert.title} (${options})` : alert.title
  const url = `${storefrontUrl.replace(/\/$/, '')}/p/${encodeURIComponent(alert.slug)}`
  return `«${name}» دوباره موجود شد.\n${url}`
}

@Injectable()
export class StockAlertsService {
  constructor(
    @Inject(STOCK_ALERT_STORE) private readonly store: StockAlertStore,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async subscribe(userId: number, variantId: number): Promise<StockAlertView[]> {
    const variant = await this.store.variant(variantId)
    if (!variant?.sellable) throw new NotFoundError('Variant not found', { variant: variantId })
    if (variant.availableQuantity > 0) throw new AlreadyInStockError(variantId)
    await this.store.subscribe(userId, variantId, this.clock.now())
    return this.store.waiting(userId)
  }

  async unsubscribe(userId: number, variantId: number): Promise<void> {
    if (!(await this.store.unsubscribe(userId, variantId))) {
      throw new NotFoundError('No alert for this item', { variant: variantId })
    }
  }

  waiting(userId: number): Promise<StockAlertView[]> {
    return this.store.waiting(userId)
  }
}

const BATCH = 200
const SWEEP_MS = 5 * 60_000

/**
 * Sends the SMS once a variant is back. Runs after catalog and stock changes,
 * and sweeps every few minutes for stock freed by cancelled orders. Each alert
 * is claimed before sending, so two API instances never text twice.
 */
@Injectable()
export class StockAlertNotifier implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(StockAlertNotifier.name)
  private sweep: NodeJS.Timeout | null = null
  private running: Promise<number> = Promise.resolve(0)

  constructor(
    @Inject(STOCK_ALERT_STORE) private readonly store: StockAlertStore,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly configService: ConfigService
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return
    this.sweep = setInterval(() => void this.notify(null), SWEEP_MS)
    this.sweep.unref()
  }

  onModuleDestroy(): void {
    if (this.sweep) clearInterval(this.sweep)
  }

  @OnEvent(CATALOG_CHANGED)
  async onCatalogChanged(change: CatalogChange): Promise<void> {
    const variantIds = change.everything
      ? null
      : [...change.variantIds, ...(await this.store.variantsOfProducts(change.productIds))]
    if (variantIds && variantIds.length === 0) return
    await this.notify(variantIds)
  }

  /** Sends every due alert (optionally only for these variants); returns how many went out. */
  notify(variantIds: number[] | null): Promise<number> {
    // One pass at a time; a pass started meanwhile waits for the current one.
    this.running = this.running
      .then(() => this.pass(variantIds))
      .catch((error: unknown) => {
        this.logger.warn(
          `Stock alerts failed: ${error instanceof Error ? error.message : String(error)}`
        )
        return 0
      })
    return this.running
  }

  private async pass(variantIds: number[] | null): Promise<number> {
    const storefront = this.configService.getOrThrow<AppConfig>('app').frontendUrl
    let sent = 0
    // A failed SMS puts its alert back; it waits for the next pass, not this one.
    const tried = new Set<number>()
    for (;;) {
      const due = await this.store.due(variantIds, BATCH)
      const fresh = due.filter((alert) => !tried.has(alert.alertId))
      if (fresh.length === 0) return sent
      for (const alert of fresh) {
        tried.add(alert.alertId)
        if (!(await this.store.claim(alert.alertId, this.clock.now()))) continue
        try {
          await this.sms.send(alert.phoneNumber, stockAlertText(alert, storefront))
          sent += 1
        } catch (error) {
          await this.store.release(alert.alertId)
          this.logger.warn(
            `Stock alert ${alert.alertId} SMS failed: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }
      if (due.length < BATCH) return sent
    }
  }
}
