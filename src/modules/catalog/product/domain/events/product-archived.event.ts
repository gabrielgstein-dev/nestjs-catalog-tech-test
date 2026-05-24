import { DomainEvent } from '../../../../../shared/domain/domain-event';

export class ProductArchived implements DomainEvent {
  static readonly EVENT_NAME = 'catalog.product.archived';
  readonly eventName = ProductArchived.EVENT_NAME;
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}
