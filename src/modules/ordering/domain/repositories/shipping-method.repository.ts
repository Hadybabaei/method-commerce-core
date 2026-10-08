import { ShippingMethod } from '../entities/shipping-method.entity'

export interface ShippingMethodRepository {
  findById(id: number): Promise<ShippingMethod | null>

  findByCode(code: string): Promise<ShippingMethod | null>

  /** Every method, active or not, by position then id. */
  list(): Promise<ShippingMethod[]>

  /** Active methods only, by position then id. */
  listActive(): Promise<ShippingMethod[]>

  save(method: ShippingMethod): Promise<ShippingMethod>

  delete(id: number): Promise<void>
}

export const SHIPPING_METHOD_REPOSITORY = Symbol('ShippingMethodRepository')
