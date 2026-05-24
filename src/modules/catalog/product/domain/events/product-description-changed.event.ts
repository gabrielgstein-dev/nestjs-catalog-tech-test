import { DomainEvent } from '../../../../../shared/domain/domain-event';

export class ProductDescriptionChanged implements DomainEvent {
  static readonly EVENT_NAME = 'catalog.product.description_changed';
  readonly eventName = ProductDescriptionChanged.EVENT_NAME;
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly description: string | null,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}
