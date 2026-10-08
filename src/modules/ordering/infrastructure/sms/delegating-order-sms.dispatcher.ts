import { Injectable } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import {
  BULLMQ_ORDER_SMS_DISPATCHER,
  OrderSms,
  OrderSmsDispatcher,
} from '../../application/ports/order-sms.port'
import { isOrderingJobsEnabled } from '../../ordering-jobs.enabled'
import { DirectOrderSmsDispatcher } from './direct-order-sms.dispatcher'

/**
 * OrderingModule always injects this token. When Redis/jobs are on, the first
 * call switches to the BullMQ adapter from OrderingJobsModule; otherwise texts
 * are sent inline.
 */
@Injectable()
export class DelegatingOrderSmsDispatcher implements OrderSmsDispatcher {
  private inner: OrderSmsDispatcher
  private resolved = false

  constructor(
    private readonly moduleRef: ModuleRef,
    direct: DirectOrderSmsDispatcher
  ) {
    this.inner = direct
  }

  dispatch(sms: OrderSms): Promise<void> {
    return this.resolve().dispatch(sms)
  }

  private resolve(): OrderSmsDispatcher {
    if (this.resolved || !isOrderingJobsEnabled()) {
      return this.inner
    }

    this.resolved = true
    try {
      const bull = this.moduleRef.get<OrderSmsDispatcher>(BULLMQ_ORDER_SMS_DISPATCHER, {
        strict: false,
      })
      if (bull) {
        this.inner = bull
      }
    } catch {
      // Jobs module is not in the graph.
    }

    return this.inner
  }
}
