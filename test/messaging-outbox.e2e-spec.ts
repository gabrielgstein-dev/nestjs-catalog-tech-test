import { randomUUID } from 'node:crypto';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { CreateProductCommand } from '../src/modules/catalog/product/application/commands/create-product.command';
import { CreateCategoryCommand } from '../src/modules/catalog/category/application/commands/create-category.command';
import { CorrelationContext } from '../src/shared/application/correlation-context';
import { ProductCreated } from '../src/modules/catalog/product/domain/events/product-created.event';
import { AUDIT_DLQ, AUDIT_MAX_ATTEMPTS } from '../src/modules/audit/infra/messaging/audit-routing';
import { ProcessDomainEventUseCase } from '../src/modules/audit/application/process-domain-event.use-case';
import { MessagingTestBed, startMessagingTestBed, waitFor } from './helpers/messaging-test-bed';

jest.setTimeout(180_000);

const purgeDlq = async (amqp: AmqpConnection): Promise<void> => {
  const ch = amqp.channel;
  if (!ch) return;
  try {
    await ch.purgeQueue(AUDIT_DLQ);
  } catch {
    // queue may not exist yet
  }
};

describe('Phase 4 — transactional outbox + audit consumer (integration)', () => {
  let bed: MessagingTestBed;
  let bus: CommandBus;
  let ds: DataSource;

  beforeAll(async () => {
    bed = await startMessagingTestBed();
    bus = bed.getCommandBus();
    ds = bed.getDataSource();
  });

  afterEach(async () => {
    await bed.truncate();
  });

  afterAll(async () => {
    await bed?.close();
  });

  describe('happy path', () => {
    it('mutation, outbox row, broker publish and audit_log row all share the correlation id', async () => {
      const correlationId = `corr-${randomUUID().slice(0, 8)}`;
      const productId = randomUUID();

      await CorrelationContext.run(correlationId, () =>
        bus.execute(new CreateProductCommand(productId, 'Phone', 'A nice phone')),
      );

      const outboxRows: Array<{
        id: string;
        event_type: string;
        aggregate_id: string;
        correlation_id: string | null;
        status: string;
      }> = await ds.query(
        `SELECT id, event_type, aggregate_id, correlation_id, status
           FROM outbox WHERE aggregate_id = $1`,
        [productId],
      );
      expect(outboxRows).toHaveLength(1);
      expect(outboxRows[0].event_type).toBe(ProductCreated.EVENT_NAME);
      expect(outboxRows[0].correlation_id).toBe(correlationId);

      const auditRow = await waitFor(
        async () => {
          const rows: Array<{ correlation_id: string | null; event_type: string }> = await ds.query(
            `SELECT correlation_id, event_type FROM audit_log WHERE aggregate_id = $1`,
            [productId],
          );
          return rows[0] ?? null;
        },
        { label: 'audit_log present' },
      );
      expect(auditRow.correlation_id).toBe(correlationId);
      expect(auditRow.event_type).toBe(ProductCreated.EVENT_NAME);

      const finalOutbox: Array<{ status: string; processed_at: Date | null }> = await ds.query(
        `SELECT status, processed_at FROM outbox WHERE aggregate_id = $1`,
        [productId],
      );
      expect(finalOutbox[0].status).toBe('PROCESSED');
      expect(finalOutbox[0].processed_at).not.toBeNull();
    });
  });

  describe('atomicity', () => {
    it('rolls back the outbox row when the mutation fails (duplicate category name)', async () => {
      await CorrelationContext.run('atom-1', () =>
        bus.execute(new CreateCategoryCommand(randomUUID(), 'Electronics')),
      );

      const firstOutbox: Array<{ count: string }> = await ds.query(
        `SELECT count(*)::text AS count FROM outbox WHERE event_type = 'catalog.category.created'`,
      );
      expect(firstOutbox[0].count).toBe('1');

      const duplicateId = randomUUID();
      await expect(
        CorrelationContext.run('atom-2', () =>
          bus.execute(new CreateCategoryCommand(duplicateId, 'Electronics')),
        ),
      ).rejects.toThrow();

      const secondOutbox: Array<{ count: string }> = await ds.query(
        `SELECT count(*)::text AS count FROM outbox WHERE aggregate_id = $1`,
        [duplicateId],
      );
      expect(secondOutbox[0].count).toBe('0');

      const totalRows: Array<{ count: string }> = await ds.query(
        `SELECT count(*)::text AS count FROM outbox WHERE event_type = 'catalog.category.created'`,
      );
      expect(totalRows[0].count).toBe('1');
    });
  });

  describe('idempotency', () => {
    it('redelivering the same event produces only one audit_log row', async () => {
      const productId = randomUUID();
      await CorrelationContext.run('idem-1', () =>
        bus.execute(new CreateProductCommand(productId, 'IdempotentPhone')),
      );

      const initial = await waitFor(
        async () => {
          const rows: Array<{ event_id: string }> = await ds.query(
            `SELECT event_id FROM audit_log WHERE aggregate_id = $1`,
            [productId],
          );
          return rows[0] ?? null;
        },
        { label: 'initial audit_log' },
      );

      const amqp = bed.app.get(AmqpConnection);
      const [outboxRow]: Array<{ event_type: string; payload: Record<string, unknown> }> =
        await ds.query(`SELECT event_type, payload FROM outbox WHERE aggregate_id = $1`, [
          productId,
        ]);

      for (let i = 0; i < 2; i++) {
        await amqp.publish('catalog.events', outboxRow.event_type, outboxRow.payload, {
          persistent: true,
          messageId: initial.event_id,
          headers: { 'x-event-id': initial.event_id, 'x-correlation-id': 'redelivery' },
        });
      }

      await new Promise((r) => setTimeout(r, 1500));

      const finalRows: Array<{ count: string }> = await ds.query(
        `SELECT count(*)::text AS count FROM audit_log WHERE aggregate_id = $1`,
        [productId],
      );
      expect(finalRows[0].count).toBe('1');

      const processedMarkers: Array<{ count: string }> = await ds.query(
        `SELECT count(*)::text AS count FROM processed_event WHERE event_id = $1`,
        [initial.event_id],
      );
      expect(processedMarkers[0].count).toBe('1');
    });
  });

  describe('broker outage', () => {
    it('mutation still commits with the broker paused and audit drains after the broker is back', async () => {
      bed.pauseRabbit();
      try {
        const productId = randomUUID();
        await CorrelationContext.run('outage', () =>
          bus.execute(new CreateProductCommand(productId, 'BrokerDownPhone')),
        );

        const pending = await waitFor(
          async () => {
            const rows: Array<{ status: string; attempts: number }> = await ds.query(
              `SELECT status, attempts FROM outbox WHERE aggregate_id = $1`,
              [productId],
            );
            return rows[0] ?? null;
          },
          { label: 'outbox PENDING while broker is paused' },
        );
        expect(pending.status).toBe('PENDING');

        const auditWhileDown: Array<{ count: string }> = await ds.query(
          `SELECT count(*)::text AS count FROM audit_log WHERE aggregate_id = $1`,
          [productId],
        );
        expect(auditWhileDown[0].count).toBe('0');

        bed.unpauseRabbit();

        const auditRow = await waitFor(
          async () => {
            const rows: Array<{ correlation_id: string | null }> = await ds.query(
              `SELECT correlation_id FROM audit_log WHERE aggregate_id = $1`,
              [productId],
            );
            return rows[0] ?? null;
          },
          { label: 'audit_log after broker resumes', timeoutMs: 30_000 },
        );
        expect(auditRow.correlation_id).toBe('outage');

        const finalOutbox: Array<{ status: string }> = await ds.query(
          `SELECT status FROM outbox WHERE aggregate_id = $1`,
          [productId],
        );
        expect(finalOutbox[0].status).toBe('PROCESSED');
      } finally {
        bed.unpauseRabbit();
      }
    });
  });

  describe('dead-letter queue', () => {
    it(`routes the message to ${AUDIT_DLQ} after ${AUDIT_MAX_ATTEMPTS} attempts when the consumer keeps failing`, async () => {
      const amqp = bed.app.get(AmqpConnection);
      await purgeDlq(amqp);

      // Force the audit consumer to throw on every invocation so the retry/N→DLQ
      // path is exercised end-to-end. Spy is restored at the end so the rest of
      // the suite still sees the real use case.
      const useCase = bed.app.get(ProcessDomainEventUseCase);
      const spy = jest
        .spyOn(useCase, 'execute')
        .mockRejectedValue(new Error('forced failure for DLQ test'));

      try {
        const productId = randomUUID();
        await CorrelationContext.run('dlq', () =>
          bus.execute(new CreateProductCommand(productId, 'PoisonPill')),
        );

        const channel = amqp.channel;
        if (!channel) throw new Error('rabbit channel not available');

        const dlqMsg = await waitFor(
          async () => {
            const msg = await channel.get(AUDIT_DLQ, { noAck: false });
            if (msg) {
              channel.nack(msg, false, false);
              return msg;
            }
            return null;
          },
          { label: 'message in audit.events.dlq', timeoutMs: 60_000 },
        );

        expect(dlqMsg.properties.messageId).toBeDefined();
        const attempts = (dlqMsg.properties.headers ?? {})['x-attempts'];
        // The last republish keeps x-attempts < N; once we re-throw at attempts >= N
        // the message is nacked, so the dead-lettered copy carries the previous count.
        expect(typeof attempts).toBe('number');
        expect(attempts).toBeGreaterThanOrEqual(AUDIT_MAX_ATTEMPTS - 1);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
