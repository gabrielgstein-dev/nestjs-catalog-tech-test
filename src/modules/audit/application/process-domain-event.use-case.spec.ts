import { DataSource, EntityManager } from 'typeorm';
import { silentBusinessActionLogger } from '../../../shared/infra/logging/__test-fixtures__/silent-business-action-logger';
import { AUDIT_CONSUMER_NAME } from '../infra/messaging/audit-routing';
import {
  DomainEventMessage,
  ProcessDomainEventUseCase,
} from './process-domain-event.use-case';

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

interface FakeManagerOptions {
  insertResult?: unknown[];
  failOnAuditInsert?: Error;
}

const makeManager = (recorded: RecordedQuery[], opts: FakeManagerOptions = {}) => {
  const manager = {
    query: jest.fn(async (sql: string, params: unknown[] = []): Promise<unknown> => {
      recorded.push({ sql, params });
      const isProcessedInsert = sql.includes('INSERT INTO processed_event');
      const isAuditInsert = sql.includes('INSERT INTO audit_log');
      if (isProcessedInsert) {
        return opts.insertResult ?? [{ event_id: params[0] }];
      }
      if (isAuditInsert) {
        if (opts.failOnAuditInsert) throw opts.failOnAuditInsert;
        return [];
      }
      return [];
    }),
  } as unknown as EntityManager;
  return manager;
};

const makeDataSource = (manager: EntityManager) => {
  return {
    transaction: jest.fn(
      async <T>(cb: (m: EntityManager) => Promise<T>): Promise<T> => cb(manager),
    ),
  } as unknown as DataSource;
};

const baseInput = (overrides: Partial<DomainEventMessage> = {}): DomainEventMessage => ({
  eventId: '11111111-1111-4111-8111-111111111111',
  eventType: 'catalog.product.created',
  aggregateType: 'catalog.product',
  aggregateId: 'a',
  payload: { foo: 'bar' },
  correlationId: 'corr-1',
  occurredAt: new Date('2026-01-02T03:04:05.678Z'),
  ...overrides,
});

describe('ProcessDomainEventUseCase', () => {
  it('inserts processed_event and audit_log on a fresh event and reports recorded=true', async () => {
    const recorded: RecordedQuery[] = [];
    const manager = makeManager(recorded);
    const ds = makeDataSource(manager);
    const sut = new ProcessDomainEventUseCase(ds, silentBusinessActionLogger());

    const input = baseInput();
    const result = await sut.execute(input);

    expect(result).toEqual({ recorded: true });
    expect(recorded).toHaveLength(2);

    const [processedInsert, auditInsert] = recorded;

    expect(processedInsert.sql).toMatch(/INSERT INTO processed_event/);
    expect(processedInsert.sql).toMatch(/ON CONFLICT DO NOTHING/);
    expect(processedInsert.params).toEqual([input.eventId, AUDIT_CONSUMER_NAME]);

    expect(auditInsert.sql).toMatch(/INSERT INTO audit_log/);
    expect(auditInsert.params).toEqual([
      input.eventId,
      input.aggregateType,
      input.aggregateId,
      input.eventType,
      JSON.stringify(input.payload),
      input.correlationId,
      input.occurredAt,
    ]);
  });

  it('is idempotent: when processed_event ON CONFLICT returns no row, skips audit_log and reports recorded=false', async () => {
    const recorded: RecordedQuery[] = [];
    const manager = makeManager(recorded, { insertResult: [] });
    const ds = makeDataSource(manager);
    const sut = new ProcessDomainEventUseCase(ds, silentBusinessActionLogger());

    const result = await sut.execute(baseInput());

    expect(result).toEqual({ recorded: false });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].sql).toMatch(/INSERT INTO processed_event/);
  });

  it('handles a non-array result from the dedupe insert as a duplicate (defensive)', async () => {
    const recorded: RecordedQuery[] = [];
    const manager = {
      query: jest.fn(async (sql: string, params: unknown[] = []): Promise<unknown> => {
        recorded.push({ sql, params });
        if (sql.includes('INSERT INTO processed_event')) {
          return undefined;
        }
        return [];
      }),
    } as unknown as EntityManager;
    const ds = makeDataSource(manager);
    const sut = new ProcessDomainEventUseCase(ds, silentBusinessActionLogger());

    const result = await sut.execute(baseInput());

    expect(result).toEqual({ recorded: false });
    expect(recorded).toHaveLength(1);
  });

  it('propagates failures from the audit_log insert (so the consumer can retry/DLQ)', async () => {
    const recorded: RecordedQuery[] = [];
    const boom = new Error('db down');
    const manager = makeManager(recorded, { failOnAuditInsert: boom });
    const ds = makeDataSource(manager);
    const sut = new ProcessDomainEventUseCase(ds, silentBusinessActionLogger());

    await expect(sut.execute(baseInput())).rejects.toBe(boom);

    // Both queries were attempted (processed_event succeeded; audit_log threw),
    // but they ran inside dataSource.transaction so a real DB would roll back.
    expect(recorded).toHaveLength(2);
    expect(ds.transaction).toHaveBeenCalledTimes(1);
  });

  it('runs both inserts inside a single dataSource.transaction call', async () => {
    const recorded: RecordedQuery[] = [];
    const manager = makeManager(recorded);
    const ds = makeDataSource(manager);
    const sut = new ProcessDomainEventUseCase(ds, silentBusinessActionLogger());

    await sut.execute(baseInput());

    expect(ds.transaction).toHaveBeenCalledTimes(1);
    // Both queries went through the same manager instance handed to the tx callback.
    expect((manager.query as jest.Mock).mock.calls).toHaveLength(2);
  });

  it('serializes the payload as JSON so jsonb cast at the boundary always receives a string', async () => {
    const recorded: RecordedQuery[] = [];
    const manager = makeManager(recorded);
    const ds = makeDataSource(manager);
    const sut = new ProcessDomainEventUseCase(ds, silentBusinessActionLogger());

    const payload = { nested: { x: 1 }, list: [1, 2, 3] };
    await sut.execute(baseInput({ payload }));

    const auditInsert = recorded.find((r) => r.sql.includes('audit_log'));
    const payloadParam = auditInsert?.params[4];
    expect(typeof payloadParam).toBe('string');
    expect(JSON.parse(payloadParam as string)).toEqual(payload);
  });

  it('persists a null correlationId without crashing when none is propagated', async () => {
    const recorded: RecordedQuery[] = [];
    const manager = makeManager(recorded);
    const ds = makeDataSource(manager);
    const sut = new ProcessDomainEventUseCase(ds, silentBusinessActionLogger());

    await sut.execute(baseInput({ correlationId: null }));

    const auditInsert = recorded.find((r) => r.sql.includes('audit_log'));
    expect(auditInsert?.params[5]).toBeNull();
  });
});
