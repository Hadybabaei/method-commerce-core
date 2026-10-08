import { Inject, Injectable } from '@nestjs/common'
import {
  BASKET_READ_MODEL,
  BasketReadModel,
} from '@modules/basket/application/ports/basket-read.port'
import { UseCase } from '@shared/application/use-case'
import { Money } from '@shared/domain/value-objects/money'
import { PaymentMethod } from '../../domain/enums/order.enums'
import { BasketNotReadyError, EmptyBasketError } from '../../domain/errors/ordering.errors'
import { Order } from '../../domain/entities/order.aggregate'
import { CheckoutPreviewView, CreateOrderCommand } from '../dto/views'
import { CheckoutAssembler } from '../services/checkout-assembler.service'

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
    const { items, weightGrams, taxRateBp } = await this.assembler.buildItems(basketView.items)
    const note = Order.normalizeNote(command.note)
    const paymentMethod = command.paymentMethod ?? PaymentMethod.CashOnDelivery
    const subtotal = items.reduce((sum, item) => sum.add(item.lineTotal), Money.zero)
    const shipping = await this.assembler.quoteShipping({
      provinceId: address.province.id,
      subtotal,
      weightGrams,
      shippingMethodId: command.shippingMethodId,
    })
    const shippingFee = shipping.selected?.fee.amount ?? 0
    const taxTotal = items.reduce((sum, item) => sum + item.taxAmount.amount, 0)

    return {
      address,
      items: items.map((item) => ({
        variantId: item.variantId as number,
        quantity: item.quantity,
        unitPrice: item.unitPrice.amount,
        lineTotal: item.lineTotal.amount,
        taxAmount: item.taxAmount.amount,
        product: item.productSnapshot,
      })),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: subtotal.amount,
      weightGrams,
      shippingMethods: shipping.options.map(({ method, fee }) => ({
        id: method.id,
        name: method.name,
        code: method.code,
        description: method.description,
        fee: fee.amount,
        minDays: method.minDays,
        maxDays: method.maxDays,
      })),
      shippingMethodId: shipping.selected?.method.id ?? null,
      shippingFee,
      taxRateBp,
      taxTotal,
      total: subtotal.amount + shippingFee + taxTotal,
      paymentMethod,
      note,
    }
  }
}
