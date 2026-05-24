import { DomainEvent } from '../../../../../shared/domain/domain-event';

export class CategoryAttachedToProduct implements DomainEvent {
  static readonly EVENT_NAME = 'catalog.product.category_attached';
  readonly eventName = CategoryAttachedToProduct.EVENT_NAME;
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly categoryId: string,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}
