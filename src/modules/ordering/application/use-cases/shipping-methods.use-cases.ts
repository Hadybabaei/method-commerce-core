import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { ShippingMethod, ShippingMethodInput } from '../../domain/entities/shipping-method.entity'
import {
  ShippingMethodCodeTakenError,
  ShippingMethodNotFoundError,
} from '../../domain/errors/ordering.errors'
import {
  SHIPPING_METHOD_REPOSITORY,
  ShippingMethodRepository,
} from '../../domain/repositories/shipping-method.repository'
import { ShippingMethodView } from '../dto/views'

export function toShippingMethodView(method: ShippingMethod): ShippingMethodView {
  return {
    id: method.id,
    name: method.name,
    code: method.code,
    description: method.description,
    baseFee: method.baseFee.amount,
    perKgFee: method.perKgFee.amount,
    freeAbove: method.freeAbove?.amount ?? null,
    minDays: method.minDays,
    maxDays: method.maxDays,
    provinceIds: method.provinceIds,
    trackingUrlTemplate: method.trackingUrlTemplate,
    isActive: method.isActive,
    position: method.position,
  }
}

@Injectable()
export class ListShippingMethodsUseCase implements UseCase<void, ShippingMethodView[]> {
  constructor(
    @Inject(SHIPPING_METHOD_REPOSITORY) private readonly methods: ShippingMethodRepository
  ) {}

  async execute(): Promise<ShippingMethodView[]> {
    const methods = await this.methods.list()
    return methods.map(toShippingMethodView)
  }
}

@Injectable()
export class CreateShippingMethodUseCase implements UseCase<
  ShippingMethodInput,
  ShippingMethodView
> {
  constructor(
    @Inject(SHIPPING_METHOD_REPOSITORY) private readonly methods: ShippingMethodRepository
  ) {}

  async execute(input: ShippingMethodInput): Promise<ShippingMethodView> {
    const method = ShippingMethod.create(input)
    if (await this.methods.findByCode(method.code)) {
      throw new ShippingMethodCodeTakenError(method.code)
    }
    return toShippingMethodView(await this.methods.save(method))
  }
}

export type UpdateShippingMethodCommand = { id: number } & Partial<ShippingMethodInput>

@Injectable()
export class UpdateShippingMethodUseCase implements UseCase<
  UpdateShippingMethodCommand,
  ShippingMethodView
> {
  constructor(
    @Inject(SHIPPING_METHOD_REPOSITORY) private readonly methods: ShippingMethodRepository
  ) {}

  async execute({ id, ...changes }: UpdateShippingMethodCommand): Promise<ShippingMethodView> {
    const method = await this.methods.findById(id)
    if (!method) {
      throw new ShippingMethodNotFoundError(id)
    }

    method.update(changes)
    const clash = await this.methods.findByCode(method.code)
    if (clash && clash.id !== id) {
      throw new ShippingMethodCodeTakenError(method.code)
    }
    return toShippingMethodView(await this.methods.save(method))
  }
}

/** Past orders keep their snapshot; the link to the method is cleared. */
@Injectable()
export class DeleteShippingMethodUseCase implements UseCase<{ id: number }, void> {
  constructor(
    @Inject(SHIPPING_METHOD_REPOSITORY) private readonly methods: ShippingMethodRepository
  ) {}

  async execute({ id }: { id: number }): Promise<void> {
    if (!(await this.methods.findById(id))) {
      throw new ShippingMethodNotFoundError(id)
    }
    await this.methods.delete(id)
  }
}
