import { DomainEvent } from '../../../../../shared/domain/domain-event';

export class ProductActivated implements DomainEvent {
  static readonly EVENT_NAME = 'catalog.product.activated';
  readonly eventName = ProductActivated.EVENT_NAME;
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}
