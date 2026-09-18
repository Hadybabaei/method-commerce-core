export type BasketLineIssue = 'UNPUBLISHED' | 'INACTIVE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK'

export interface BasketLineView {
  variantId: number
  quantity: number
  unitPrice: number
  lineTotal: number
  availableQuantity: number
  product: {
    id: number
    title: string
    slug: string
    thumbnail: string | null
  }
  variant: {
    sku: string
    options: { option: string; value: string }[]
    image: string | null
    isActive: boolean
  }
  /** Empty when the line can be checked out as-is. */
  issues: BasketLineIssue[]
}

export interface BasketView {
  id: number
  itemCount: number
  totalQuantity: number
  /** Sum of line totals for lines without blocking issues. */
  subtotal: number
  items: BasketLineView[]
}

export interface AddBasketItemCommand {
  userId: number
  variantId: number
  quantity: number
}

export interface ChangeBasketItemQuantityCommand {
  userId: number
  variantId: number
  quantity: number
}

export interface AdjustBasketItemCommand {
  userId: number
  variantId: number
  by?: number
}

export interface BasketUserCommand {
  userId: number
}

export interface RemoveBasketItemCommand {
  userId: number
  variantId: number
}
