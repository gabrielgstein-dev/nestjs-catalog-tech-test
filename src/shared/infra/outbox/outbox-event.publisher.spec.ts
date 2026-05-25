import type { EntityManager } from 'typeorm';
import { CorrelationContext } from '../../application/correlation-context';
import { TransactionContext } from '../../application/transaction-context';
import { silentBusinessActionLogger } from '../logging/__test-fixtures__/silent-business-action-logger';
import { OutboxEventPublisher } from './outbox-event.publisher';

class FakeEvent {
  constructor(
    public readonly aggregateId: string,
    public readonly eventName: string,
    public readonly occurredAt: Date,
  ) {}
}

describe('OutboxEventPublisher', () => {
  it('is a no-op for an empty event list (does not require an active UoW)', async () => {
    const sut = new OutboxEventPublisher(silentBusinessActionLogger());
    await expect(sut.publish([])).resolves.toBeUndefined();
  });

  it('throws a guidance error when called outside an active TransactionContext (UoW contract)', async () => {
    const sut = new OutboxEventPublisher(silentBusinessActionLogger());
    const event = new FakeEvent('agg-1', 'catalog.product.created', new Date());
    await expect(sut.publish([event as never])).rejects.toThrow(/requires an active UnitOfWork/);
  });

  it('writes one outbox row per event with derived aggregate type and ambient correlationId', async () => {
    const recorded: Array<{ sql: string; params: unknown[] }> = [];
    const manager = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        recorded.push({ sql, params });
        return [{ id: `gen-${recorded.length}` }];
      }),
    } as unknown as EntityManager;

    const sut = new OutboxEventPublisher(silentBusinessActionLogger());
    const e1 = new FakeEvent('agg-1', 'catalog.product.created', new Date('2026-01-01T00:00:00Z'));
    const e2 = new FakeEvent(
      'agg-1',
      'catalog.product.activated',
      new Date('2026-01-01T00:00:01Z'),
    );

    await CorrelationContext.run('corr-pub', () =>
      TransactionContext.run(manager, () => sut.publish([e1 as never, e2 as never])),
    );

    expect(recorded).toHaveLength(2);
    expect(recorded[0].sql).toMatch(/INSERT INTO outbox/);
    expect(recorded[0].params[0]).toBe('catalog.product'); // aggregate_type derived
    expect(recorded[0].params[1]).toBe('agg-1');
    expect(recorded[0].params[2]).toBe('catalog.product.created');
    // payload is a serialised JSON string; Date fields become ISO strings.
    expect(typeof recorded[0].params[3]).toBe('string');
    const payload = JSON.parse(recorded[0].params[3] as string);
    expect(payload.occurredAt).toBe('2026-01-01T00:00:00.000Z');
    expect(recorded[0].params[6]).toBe('corr-pub');
    expect(recorded[1].params[2]).toBe('catalog.product.activated');
  });

  it('persists a null correlation_id when CorrelationContext is not set', async () => {
    const recorded: Array<{ params: unknown[] }> = [];
    const manager = {
      query: jest.fn(async (_sql: string, params: unknown[]) => {
        recorded.push({ params });
        return [{ id: 'gen-1' }];
      }),
    } as unknown as EntityManager;

    const sut = new OutboxEventPublisher(silentBusinessActionLogger());
    const e = new FakeEvent('agg-2', 'catalog.product.created', new Date());

    await TransactionContext.run(manager, () => sut.publish([e as never]));

    expect(recorded[0].params[6]).toBeNull();
  });
});
