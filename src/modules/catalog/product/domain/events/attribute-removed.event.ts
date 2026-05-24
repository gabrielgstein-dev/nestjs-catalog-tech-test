import { DomainEvent } from '../../../../../shared/domain/domain-event';

export class AttributeRemoved implements DomainEvent {
  static readonly EVENT_NAME = 'catalog.product.attribute_removed';
  readonly eventName = AttributeRemoved.EVENT_NAME;
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly key: string,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}
