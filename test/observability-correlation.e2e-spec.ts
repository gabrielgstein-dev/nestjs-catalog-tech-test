import { randomUUID } from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { CreateProductCommand } from '../src/modules/catalog/product/application/commands/create-product.command';
import { CorrelationContext } from '../src/shared/application/correlation-context';
import { MessagingTestBed, startMessagingTestBed, waitFor } from './helpers/messaging-test-bed';

jest.setTimeout(180_000);

interface LogEntry {
  action: string;
  outcome?: string;
  correlationId?: string | null;
  [k: string]: unknown;
}

const ACTIONS_REQUIRED = [
  'catalog.product.created',
  'messaging.outbox.enqueued',
  'messaging.outbox.published',
  'audit.event.received',
  'audit.event.persisted',
];

describe('Phase 5 — observability: correlationId crosses HTTP -> outbox -> consumer -> audit', () => {
  let bed: MessagingTestBed;
  let bus: CommandBus;
  let ds: DataSource;
  const captured: LogEntry[] = [];

  const recordIfActionLog = (args: unknown[]): void => {
    const [first] = args;
    if (first && typeof first === 'object' && 'action' in (first as Record<string, unknown>)) {
      captured.push(first as LogEntry);
    }
  };

  beforeAll(async () => {
    jest
      .spyOn(PinoLogger.prototype, 'info')
      .mockImplementation((...args: unknown[]) => recordIfActionLog(args));
    jest
      .spyOn(PinoLogger.prototype, 'warn')
      .mockImplementation((...args: unknown[]) => recordIfActionLog(args));
    jest
      .spyOn(PinoLogger.prototype, 'error')
      .mockImplementation((...args: unknown[]) => recordIfActionLog(args));

    bed = await startMessagingTestBed();
    bus = bed.getCommandBus();
    ds = bed.getDataSource();
  });

  afterEach(async () => {
    captured.length = 0;
    await bed.truncate();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await bed?.close();
  });

  it('every action log of a create-product flow carries the originating correlationId', async () => {
    const correlationId = `corr-${randomUUID().slice(0, 8)}`;
    const productId = randomUUID();

    await CorrelationContext.run(correlationId, () =>
      bus.execute(new CreateProductCommand(productId, 'Tracked Phone', 'A tracked phone')),
    );

    await waitFor(
      async () => {
        const rows: Array<{ event_id: string }> = await ds.query(
          `SELECT event_id FROM audit_log WHERE aggregate_id = $1`,
          [productId],
        );
        return rows[0] ?? null;
      },
      { label: 'audit_log present' },
    );

    await waitFor(
      async () =>
        ACTIONS_REQUIRED.every((action) =>
          captured.some(
            (e) =>
              e.action === action &&
              (e.aggregateId === productId ||
                e.productId === productId ||
                (action.startsWith('audit.event') && e.correlationId === correlationId)),
          ),
        )
          ? true
          : null,
      { label: 'all required actions emitted', timeoutMs: 10_000 },
    );

    for (const action of ACTIONS_REQUIRED) {
      const entry = captured.find(
        (e) =>
          e.action === action &&
          (e.aggregateId === productId ||
            e.productId === productId ||
            (action.startsWith('audit.event') && e.correlationId === correlationId)),
      );
      expect({ action, entry }).toEqual({
        action,
        entry: expect.objectContaining({ action, correlationId }),
      });
    }

    const distinctCorrelationIds = new Set(
      captured
        .filter(
          (e) =>
            ACTIONS_REQUIRED.includes(e.action) &&
            (e.aggregateId === productId ||
              e.productId === productId ||
              e.action.startsWith('audit.event')),
        )
        .map((e) => e.correlationId),
    );
    expect([...distinctCorrelationIds]).toEqual([correlationId]);
  });

  it('a rejected business rule emits outcome=failure with reason from DomainError', async () => {
    const { CreateCategoryCommand } = await import(
      '../src/modules/catalog/category/application/commands/create-category.command'
    );

    const correlationId = `corr-fail-${randomUUID().slice(0, 8)}`;

    await CorrelationContext.run(correlationId, () =>
      bus.execute(new CreateCategoryCommand(randomUUID(), 'DuplicateName')),
    );

    captured.length = 0;

    await expect(
      CorrelationContext.run(correlationId, () =>
        bus.execute(new CreateCategoryCommand(randomUUID(), 'DuplicateName')),
      ),
    ).rejects.toThrow();

    const failureLog = captured.find(
      (e) => e.action === 'catalog.category.created' && e.outcome === 'failure',
    );
    expect(failureLog).toBeDefined();
    expect(failureLog?.correlationId).toBe(correlationId);
    expect(failureLog?.reason).toBe('category.duplicate_name');
  });
});
