import { Inject, Injectable } from '@nestjs/common'
import {
  USER_REPOSITORY,
  UserRepository,
} from '@modules/identity/domain/repositories/user.repository'
import {
  STORE_SETTINGS,
  StoreSettingsRepository,
} from '@modules/store/application/store-settings.port'
import { SellerDetails } from '@modules/store/domain/store-settings'
import { UseCase } from '@shared/application/use-case'
import { BusinessRuleViolationError } from '@shared/domain/errors'
import { OrderStatus, PaymentMethod } from '../../domain/enums/order.enums'
import { OrderNotFoundError, OrderNotOwnedError } from '../../domain/errors/ordering.errors'
import { AddressSnapshot } from '../dto/views'
import { ORDER_READ_MODEL, OrderReadModel } from '../ports/order-read.port'

const INVOICED_STATUSES = [
  OrderStatus.Paid,
  OrderStatus.Processing,
  OrderStatus.Shipped,
  OrderStatus.Completed,
]

export class InvoiceNotAvailableError extends BusinessRuleViolationError {
  constructor(status: string) {
    super('An invoice is issued once the order is paid', { status })
  }
}

export interface InvoiceLineView {
  title: string
  sku: string
  options: { option: string; value: string }[]
  quantity: number
  unitPrice: number
  /** quantity × unitPrice, before VAT. */
  lineTotal: number
  taxAmount: number
  /** lineTotal + taxAmount. */
  total: number
}

export interface InvoiceView {
  /** The order number doubles as the invoice number. */
  number: string
  issuedAt: Date
  status: OrderStatus
  paymentMethod: PaymentMethod
  seller: SellerDetails
  buyer: {
    name: string | null
    phone: string | null
    nationalId: string | null
    address: string
    postalCode: string
  }
  lines: InvoiceLineView[]
  subtotal: number
  shippingFee: number
  taxRateBp: number
  taxTotal: number
  total: number
  refundedTotal: number
}

export interface GetInvoiceQuery {
  orderId: number
  /** When set, the order must belong to this customer. */
  userId?: number
}

/** Printable sales invoice for a paid order. Money in Rial. */
@Injectable()
export class GetInvoiceUseCase implements UseCase<GetInvoiceQuery, InvoiceView> {
  constructor(
    @Inject(ORDER_READ_MODEL) private readonly orders: OrderReadModel,
    @Inject(STORE_SETTINGS) private readonly settings: StoreSettingsRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository
  ) {}

  async execute(query: GetInvoiceQuery): Promise<InvoiceView> {
    const order = await this.orders.findById(query.orderId)
    if (!order) {
      throw new OrderNotFoundError(query.orderId)
    }
    if (query.userId !== undefined && order.userId !== query.userId) {
      throw new OrderNotOwnedError()
    }
    if (!INVOICED_STATUSES.includes(order.status) || !order.paidAt) {
      throw new InvoiceNotAvailableError(order.status)
    }

    const [{ seller }, user] = await Promise.all([
      this.settings.get(),
      this.users.findById(order.userId),
    ])
    const receiver = order.address.receiver

    return {
      number: order.number,
      issuedAt: order.paidAt,
      status: order.status,
      paymentMethod: order.paymentMethod,
      seller,
      buyer: {
        name:
          user?.profile?.fullName ?? (receiver.isAccountOwner ? null : receiver.fullName) ?? null,
        phone: user?.phoneNumber.value ?? receiver.phoneNumber,
        nationalId: user?.profile?.nationalId?.value ?? null,
        address: formatAddress(order.address),
        postalCode: order.address.postalCode,
      },
      lines: order.items.map((item) => ({
        title: item.product.title,
        sku: item.product.sku,
        options: item.product.options,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        taxAmount: item.taxAmount,
        total: item.lineTotal + item.taxAmount,
      })),
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      taxRateBp: order.taxRateBp,
      taxTotal: order.taxTotal,
      total: order.total,
      refundedTotal: order.refundedTotal,
    }
  }
}

function formatAddress(address: AddressSnapshot): string {
  return [
    address.province.name,
    address.city.name,
    address.hood,
    address.details,
    `پلاک ${address.pelak}`,
    address.vahed ? `واحد ${address.vahed}` : null,
  ]
    .filter((part) => part && part.trim())
    .join('، ')
}
