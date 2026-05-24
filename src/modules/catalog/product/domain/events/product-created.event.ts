import { DomainEvent } from '../../../../../shared/domain/domain-event';
import { ProductStatus } from '../value-objects/product-status';

export class ProductCreated implements DomainEvent {
  static readonly EVENT_NAME = 'catalog.product.created';
  readonly eventName = ProductCreated.EVENT_NAME;
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly name: string,
    public readonly status: ProductStatus,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}
