import { DomainEvent } from '../../../../../shared/domain/domain-event';

export class AttributeUpdated implements DomainEvent {
  static readonly EVENT_NAME = 'catalog.product.attribute_updated';
  readonly eventName = AttributeUpdated.EVENT_NAME;
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly key: string,
    public readonly value: string,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}
