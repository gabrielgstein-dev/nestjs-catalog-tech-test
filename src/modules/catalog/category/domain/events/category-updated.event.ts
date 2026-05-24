import { DomainEvent } from '../../../../../shared/domain/domain-event';

export interface CategoryChanges {
  readonly name?: string;
  readonly parentId?: string | null;
}

export class CategoryUpdated implements DomainEvent {
  static readonly EVENT_NAME = 'catalog.category.updated';
  readonly eventName = CategoryUpdated.EVENT_NAME;
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly changes: CategoryChanges,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}
