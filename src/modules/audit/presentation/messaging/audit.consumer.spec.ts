import type { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import type { ConsumeMessage } from 'amqplib';
import { AppConfigService } from '../../../../shared/config/app-config.service';
import { CORRELATION_ID_HEADER } from '../../../../shared/infra/http/correlation-id.constants';
import { silentBusinessActionLogger } from '../../../../shared/infra/logging/__test-fixtures__/silent-business-action-logger';
import { ProcessDomainEventUseCase } from '../../application/process-domain-event.use-case';
import { AUDIT_MAX_ATTEMPTS, CATALOG_EXCHANGE } from '../../infra/messaging/audit-routing';
import { AuditConsumer } from './audit.consumer';

const makeMsg = (
  overrides: Partial<{
    headers: Record<string, unknown>;
    messageId: string | undefined;
    routingKey: string;
  }> = {},
): ConsumeMessage =>
  ({
    fields: { routingKey: overrides.routingKey ?? 'catalog.product.created' },
    properties: {
      messageId: overrides.messageId,
      headers: overrides.headers ?? {},
    },
  }) as unknown as ConsumeMessage;

const makeAmqp = () => {
  const publish = jest.fn().mockResolvedValue(undefined);
  return {
    spy: publish,
    amqp: { publish } as unknown as AmqpConnection,
  };
};

const makeConfig = (): AppConfigService =>
  ({ rabbitmq: { exchange: CATALOG_EXCHANGE, url: 'amqp://test' } }) as unknown as AppConfigService;

const makeUseCase = (
  execute: jest.Mock = jest.fn().mockResolvedValue({ recorded: true }),
): ProcessDomainEventUseCase => ({ execute }) as unknown as ProcessDomainEventUseCase;

const validMessage = () => ({
  eventName: 'catalog.product.created',
  aggregateId: 'agg-1',
  occurredAt: '2026-01-02T03:04:05.000Z',
  extra: 'kept-in-payload',
});

describe('AuditConsumer.handle', () => {
  describe('happy path', () => {
    it('builds DomainEventMessage from headers + body and calls the use case', async () => {
      const execute = jest.fn().mockResolvedValue({ recorded: true });
      const useCase = makeUseCase(execute);
      const { amqp } = makeAmqp();
      const sut = new AuditConsumer(useCase, amqp, makeConfig(), silentBusinessActionLogger());

      const msg = validMessage();
      const consumed = makeMsg({
        headers: {
          'x-event-id': 'evt-1',
          [CORRELATION_ID_HEADER]: 'corr-1',
          'x-attempts': 0,
        },
      });

      await sut.handle(msg, consumed);

      expect(execute).toHaveBeenCalledTimes(1);
      const arg = execute.mock.calls[0][0];
      expect(arg.eventId).toBe('evt-1');
      expect(arg.eventType).toBe('catalog.product.created');
      expect(arg.aggregateType).toBe('catalog.product');
      expect(arg.aggregateId).toBe('agg-1');
      expect(arg.correlationId).toBe('corr-1');
      expect(arg.occurredAt).toEqual(new Date('2026-01-02T03:04:05.000Z'));
      expect(arg.payload).toBe(msg);
    });

    it('falls back to properties.messageId when x-event-id header is absent', async () => {
      const execute = jest.fn().mockResolvedValue({ recorded: true });
      const sut = new AuditConsumer(
        makeUseCase(execute),
        makeAmqp().amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );

      await sut.handle(
        validMessage(),
        makeMsg({ messageId: 'msg-id-from-properties', headers: {} }),
      );

      expect(execute.mock.calls[0][0].eventId).toBe('msg-id-from-properties');
    });

    it('falls back to the AMQP routing key when message.eventName is missing', async () => {
      const execute = jest.fn().mockResolvedValue({ recorded: true });
      const sut = new AuditConsumer(
        makeUseCase(execute),
        makeAmqp().amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );
      const msg = validMessage();
      delete (msg as Partial<ReturnType<typeof validMessage>>).eventName;

      await sut.handle(
        msg as ReturnType<typeof validMessage>,
        makeMsg({
          headers: { 'x-event-id': 'evt-2' },
          routingKey: 'catalog.category.renamed',
        }),
      );

      expect(execute.mock.calls[0][0].eventType).toBe('catalog.category.renamed');
      expect(execute.mock.calls[0][0].aggregateType).toBe('catalog.category');
    });

    it('defaults occurredAt to now() when not supplied', async () => {
      const execute = jest.fn().mockResolvedValue({ recorded: true });
      const sut = new AuditConsumer(
        makeUseCase(execute),
        makeAmqp().amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );

      const msg = { ...validMessage() };
      delete (msg as Partial<ReturnType<typeof validMessage>>).occurredAt;
      const before = Date.now();
      await sut.handle(
        msg as ReturnType<typeof validMessage>,
        makeMsg({ headers: { 'x-event-id': 'evt-3' } }),
      );
      const after = Date.now();

      const got = execute.mock.calls[0][0].occurredAt as Date;
      expect(got).toBeInstanceOf(Date);
      expect(got.getTime()).toBeGreaterThanOrEqual(before);
      expect(got.getTime()).toBeLessThanOrEqual(after);
    });

    it('passes a Date occurredAt through unchanged', async () => {
      const execute = jest.fn().mockResolvedValue({ recorded: true });
      const sut = new AuditConsumer(
        makeUseCase(execute),
        makeAmqp().amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );
      const date = new Date('2026-01-01T00:00:00.000Z');
      await sut.handle(
        { ...validMessage(), occurredAt: date },
        makeMsg({ headers: { 'x-event-id': 'evt-4' } }),
      );
      expect(execute.mock.calls[0][0].occurredAt).toBe(date);
    });

    it('falls back to now() when occurredAt is a malformed string', async () => {
      const execute = jest.fn().mockResolvedValue({ recorded: true });
      const sut = new AuditConsumer(
        makeUseCase(execute),
        makeAmqp().amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );
      const before = Date.now();
      await sut.handle(
        { ...validMessage(), occurredAt: 'not-a-date' },
        makeMsg({ headers: { 'x-event-id': 'evt-5' } }),
      );
      const after = Date.now();

      const got = execute.mock.calls[0][0].occurredAt as Date;
      expect(got).toBeInstanceOf(Date);
      expect(got.getTime()).toBeGreaterThanOrEqual(before);
      expect(got.getTime()).toBeLessThanOrEqual(after);
    });

    it('defaults correlationId to null when header missing', async () => {
      const execute = jest.fn().mockResolvedValue({ recorded: true });
      const sut = new AuditConsumer(
        makeUseCase(execute),
        makeAmqp().amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );
      await sut.handle(validMessage(), makeMsg({ headers: { 'x-event-id': 'evt-6' } }));
      expect(execute.mock.calls[0][0].correlationId).toBeNull();
    });
  });

  describe('input guards (immediate DLQ via throw)', () => {
    it('throws missing_event_id when neither header nor messageId is present', async () => {
      const execute = jest.fn();
      const sut = new AuditConsumer(
        makeUseCase(execute),
        makeAmqp().amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );

      await expect(
        sut.handle(validMessage(), makeMsg({ headers: {}, messageId: undefined })),
      ).rejects.toThrow('missing_event_id');
      expect(execute).not.toHaveBeenCalled();
    });

    it('throws malformed_event when aggregateId is missing in the body', async () => {
      const execute = jest.fn();
      const sut = new AuditConsumer(
        makeUseCase(execute),
        makeAmqp().amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );

      const broken = { ...validMessage(), aggregateId: undefined } as Record<string, unknown>;
      await expect(
        sut.handle(broken, makeMsg({ headers: { 'x-event-id': 'evt-bad' } })),
      ).rejects.toThrow('malformed_event');
      expect(execute).not.toHaveBeenCalled();
    });

    it('throws malformed_event when eventName is missing AND routing key cannot be string-coerced', async () => {
      const execute = jest.fn();
      const sut = new AuditConsumer(
        makeUseCase(execute),
        makeAmqp().amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );

      const msg = { ...validMessage(), eventName: 123 as unknown as string };
      // The handler accepts eventName if it is already a string; otherwise it falls back
      // to routingKey. Forcing routingKey to undefined exercises the malformed_event guard.
      const consumed = {
        fields: { routingKey: undefined as unknown as string },
        properties: { headers: { 'x-event-id': 'evt-bad-name' } },
      } as unknown as ConsumeMessage;

      await expect(sut.handle(msg, consumed)).rejects.toThrow('malformed_event');
    });
  });

  describe('retry vs dead-letter on use-case failure', () => {
    it('on attempts < MAX, increments x-attempts and republishes (does NOT throw)', async () => {
      const execute = jest.fn().mockRejectedValue(new Error('transient'));
      const { amqp, spy } = makeAmqp();
      const sut = new AuditConsumer(
        makeUseCase(execute),
        amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );

      const msg = validMessage();
      await expect(
        sut.handle(
          msg,
          makeMsg({
            headers: {
              'x-event-id': 'evt-retry',
              [CORRELATION_ID_HEADER]: 'corr-retry',
              'x-attempts': 1,
            },
          }),
        ),
      ).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledTimes(1);
      const [exchange, routingKey, body, opts] = spy.mock.calls[0];
      expect(exchange).toBe(CATALOG_EXCHANGE);
      expect(routingKey).toBe('catalog.product.created');
      expect(body).toBe(msg);
      expect(opts.persistent).toBe(true);
      expect(opts.messageId).toBe('evt-retry');
      expect(opts.headers['x-attempts']).toBe(2);
      expect(opts.headers[CORRELATION_ID_HEADER]).toBe('corr-retry');
      expect(opts.headers['x-event-id']).toBe('evt-retry');
    });

    it(`on attempts >= ${AUDIT_MAX_ATTEMPTS}, re-throws so RabbitMQ routes to the DLQ`, async () => {
      const failure = new Error('persistent');
      const execute = jest.fn().mockRejectedValue(failure);
      const { amqp, spy } = makeAmqp();
      const sut = new AuditConsumer(
        makeUseCase(execute),
        amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );

      // Header value (MAX-1) → attempts becomes MAX after increment → matches >= guard.
      await expect(
        sut.handle(
          validMessage(),
          makeMsg({
            headers: { 'x-event-id': 'evt-dlq', 'x-attempts': AUDIT_MAX_ATTEMPTS - 1 },
          }),
        ),
      ).rejects.toBe(failure);

      expect(spy).not.toHaveBeenCalled();
    });

    it('treats missing x-attempts as 0 (first attempt becomes 1)', async () => {
      const execute = jest.fn().mockRejectedValue(new Error('transient'));
      const { amqp, spy } = makeAmqp();
      const sut = new AuditConsumer(
        makeUseCase(execute),
        amqp,
        makeConfig(),
        silentBusinessActionLogger(),
      );

      await sut.handle(validMessage(), makeMsg({ headers: { 'x-event-id': 'evt-first' } }));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][3].headers['x-attempts']).toBe(1);
    });
  });
});
