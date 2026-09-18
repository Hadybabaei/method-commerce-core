import { Inject, Injectable } from '@nestjs/common'
import {
  BASKET_READ_MODEL,
  BasketReadModel,
} from '@modules/basket/application/ports/basket-read.port'
import { UseCase } from '@shared/application/use-case'
import { PaymentMethod } from '../../domain/enums/order.enums'
import { BasketNotReadyError, EmptyBasketError } from '../../domain/errors/ordering.errors'
import { Order } from '../../domain/entities/order.aggregate'
import { CheckoutPreviewView, CreateOrderCommand } from '../dto/views'
import {
  CHECKOUT_SHIPPING_FEE_RIAL,
  CheckoutAssembler,
} from '../services/checkout-assembler.service'

@Injectable()
export class PreviewCheckoutUseCase implements UseCase<CreateOrderCommand, CheckoutPreviewView> {
  constructor(
    @Inject(BASKET_READ_MODEL) private readonly basketReads: BasketReadModel,
    private readonly assembler: CheckoutAssembler
  ) {}

  async execute(command: CreateOrderCommand): Promise<CheckoutPreviewView> {
    const basketView = await this.basketReads.getByUserId(command.userId)
    if (!basketView || basketView.items.length === 0) {
      throw new EmptyBasketError()
    }

    const blocked = basketView.items.filter((line) => line.issues.length > 0)
    if (blocked.length > 0) {
      throw new BasketNotReadyError({
        lines: blocked.map((line) => ({
          variantId: line.variantId,
          issues: line.issues,
        })),
      })
    }

    const address = await this.assembler.requireOwnedAddress(command.userId, command.addressId)
    const items = await this.assembler.buildItems(basketView.items)
    const note = Order.normalizeNote(command.note)
    const paymentMethod = command.paymentMethod ?? PaymentMethod.CashOnDelivery
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal.amount, 0)
    const shippingFee = CHECKOUT_SHIPPING_FEE_RIAL

    return {
      address,
      items: items.map((item) => ({
        variantId: item.variantId as number,
        quantity: item.quantity,
        unitPrice: item.unitPrice.amount,
        lineTotal: item.lineTotal.amount,
        product: item.productSnapshot,
      })),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
      paymentMethod,
      note,
    }
  }
}
