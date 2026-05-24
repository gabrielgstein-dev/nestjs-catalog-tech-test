import { DomainEvent } from '../../../../../shared/domain/domain-event';

export class ProductRenamed implements DomainEvent {
  static readonly EVENT_NAME = 'catalog.product.renamed';
  readonly eventName = ProductRenamed.EVENT_NAME;
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly name: string,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}
