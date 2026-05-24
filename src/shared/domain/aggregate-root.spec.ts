import { AggregateRoot } from './aggregate-root';
import { DomainEvent } from './domain-event';

class FakeEvent implements DomainEvent {
  readonly eventName = 'fake.event';
  readonly occurredAt = new Date();
  constructor(readonly aggregateId: string) {}
}

class FakeAggregate extends AggregateRoot {
  emit(id: string): void {
    this.recordEvent(new FakeEvent(id));
  }
}

describe('AggregateRoot', () => {
  it('records and pulls events, clearing the buffer', () => {
    const agg = new FakeAggregate();
    agg.emit('1');
    agg.emit('2');

    const first = agg.pullDomainEvents();
    expect(first).toHaveLength(2);
    expect(first[0]).toBeInstanceOf(FakeEvent);

    const second = agg.pullDomainEvents();
    expect(second).toHaveLength(0);
  });

  it('peekDomainEvents does not clear the buffer', () => {
    const agg = new FakeAggregate();
    agg.emit('1');

    expect(agg.peekDomainEvents()).toHaveLength(1);
    expect(agg.peekDomainEvents()).toHaveLength(1);
  });
});
