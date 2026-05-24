import { DomainEvent } from '../../../../../shared/domain/domain-event';

export class CategoryDetachedFromProduct implements DomainEvent {
  static readonly EVENT_NAME = 'catalog.product.category_detached';
  readonly eventName = CategoryDetachedFromProduct.EVENT_NAME;
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly categoryId: string,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}
