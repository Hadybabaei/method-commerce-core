import { ApiProperty } from '@nestjs/swagger'
import {
  ORDER_STATUSES,
  OrderStatus,
  PAYMENT_METHODS,
  PaymentMethod,
} from '../../domain/enums/order.enums'
import { InvoiceLineView, InvoiceView } from '../../application/use-cases/get-invoice.use-case'

class InvoiceSellerResponse {
  @ApiProperty({ nullable: true }) legalName: string | null
  @ApiProperty({ nullable: true, description: 'کد اقتصادی' }) economicCode: string | null
  @ApiProperty({ nullable: true, description: 'شناسه ملی' }) nationalId: string | null
  @ApiProperty({ nullable: true }) registrationNo: string | null
  @ApiProperty({ nullable: true }) address: string | null
  @ApiProperty({ nullable: true }) postalCode: string | null
  @ApiProperty({ nullable: true }) phone: string | null
}

class InvoiceBuyerResponse {
  @ApiProperty({ nullable: true }) name: string | null
  @ApiProperty({ nullable: true }) phone: string | null
  @ApiProperty({ nullable: true }) nationalId: string | null
  @ApiProperty() address: string
  @ApiProperty() postalCode: string
}

class InvoiceLineResponse implements InvoiceLineView {
  @ApiProperty() title: string
  @ApiProperty() sku: string
  @ApiProperty({ example: [{ option: 'رنگ', value: 'قرمز' }] })
  options: { option: string; value: string }[]
  @ApiProperty() quantity: number
  @ApiProperty({ description: 'Rial.' }) unitPrice: number
  @ApiProperty({ description: 'Before discount and VAT, Rial.' }) lineTotal: number
  @ApiProperty({ description: 'Rial.' }) discountAmount: number
  @ApiProperty({ description: 'Rial.' }) taxAmount: number
  @ApiProperty({ description: 'lineTotal - discountAmount + taxAmount, Rial.' }) total: number
}

export class InvoiceResponse implements InvoiceView {
  @ApiProperty({ example: 'ORD-20261008-00001', description: 'Also the invoice number.' })
  number: string

  @ApiProperty({ description: 'When the order was paid.' })
  issuedAt: Date

  @ApiProperty({ enum: ORDER_STATUSES })
  status: OrderStatus

  @ApiProperty({ enum: PAYMENT_METHODS })
  paymentMethod: PaymentMethod

  @ApiProperty({ type: InvoiceSellerResponse })
  seller: InvoiceSellerResponse

  @ApiProperty({ type: InvoiceBuyerResponse })
  buyer: InvoiceBuyerResponse

  @ApiProperty({ type: [InvoiceLineResponse] })
  lines: InvoiceLineResponse[]

  @ApiProperty() subtotal: number
  @ApiProperty() shippingFee: number
  @ApiProperty() discountTotal: number
  @ApiProperty({ description: 'Basis points; 1000 = 10%.' }) taxRateBp: number
  @ApiProperty() taxTotal: number
  @ApiProperty() total: number
  @ApiProperty() refundedTotal: number
}
