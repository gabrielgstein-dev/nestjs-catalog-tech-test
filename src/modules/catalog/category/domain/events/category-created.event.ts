import { DomainEvent } from '../../../../../shared/domain/domain-event';

export class CategoryCreated implements DomainEvent {
  static readonly EVENT_NAME = 'catalog.category.created';
  readonly eventName = CategoryCreated.EVENT_NAME;
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly name: string,
    public readonly parentId: string | null,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}
