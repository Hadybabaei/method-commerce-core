import { Injectable } from '@nestjs/common'
import { Clock } from '@shared/application/ports/clock.port'

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }

  secondsFromNow(seconds: number): Date {
    return new Date(Date.now() + seconds * 1000)
  }
}
