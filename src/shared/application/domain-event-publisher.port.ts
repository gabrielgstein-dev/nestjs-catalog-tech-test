import { DomainEvent } from '../domain/domain-event';

export const DOMAIN_EVENT_PUBLISHER = Symbol('DomainEventPublisher');

export interface DomainEventPublisher {
  publish(events: ReadonlyArray<DomainEvent>): Promise<void>;
}
