import { DomainEvent } from '../../domain/domain-event';
import { DomainEventPublisher } from '../domain-event-publisher.port';

export class InMemoryDomainEventPublisher implements DomainEventPublisher {
  readonly published: DomainEvent[] = [];

  async publish(events: ReadonlyArray<DomainEvent>): Promise<void> {
    this.published.push(...events);
  }

  clear(): void {
    this.published.length = 0;
  }

  byName(eventName: string): DomainEvent[] {
    return this.published.filter((e) => e.eventName === eventName);
  }
}
