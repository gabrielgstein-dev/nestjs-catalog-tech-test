import { PinoLogger } from 'nestjs-pino';
import { BusinessActionLogger } from './business-action.logger';
import { CorrelationContext } from '../../application/correlation-context';

const buildPino = () => {
  const info = jest.fn();
  const warn = jest.fn();
  const error = jest.fn();
  const setContext = jest.fn();
  return {
    pino: { info, warn, error, setContext } as unknown as PinoLogger,
    info,
    warn,
    error,
    setContext,
  };
};

describe('BusinessActionLogger', () => {
  it('emits info with outcome=success and correlationId pulled from CorrelationContext', () => {
    const { pino, info } = buildPino();
    const log = new BusinessActionLogger(pino);

    CorrelationContext.run('corr-1', () => {
      log.success({ action: 'catalog.product.created', productId: 'pid-1' });
    });

    expect(info).toHaveBeenCalledTimes(1);
    const [payload, msg] = info.mock.calls[0];
    expect(payload).toEqual({
      action: 'catalog.product.created',
      productId: 'pid-1',
      outcome: 'success',
      correlationId: 'corr-1',
    });
    expect(msg).toBe('catalog.product.created');
  });

  it('emits warn with outcome=failure + reason on failure()', () => {
    const { pino, warn } = buildPino();
    const log = new BusinessActionLogger(pino);

    CorrelationContext.run('corr-fail', () => {
      log.failure({
        action: 'catalog.product.activate',
        productId: 'pid-2',
        reason: 'name_taken',
      });
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toEqual({
      action: 'catalog.product.activate',
      productId: 'pid-2',
      reason: 'name_taken',
      outcome: 'failure',
      correlationId: 'corr-fail',
    });
  });

  it('emits error with outcome=failure on error() and carries err if provided', () => {
    const { pino, error } = buildPino();
    const log = new BusinessActionLogger(pino);
    const boom = new Error('boom');

    log.error({ action: 'catalog.product.create', reason: 'unexpected_error', err: boom });

    expect(error).toHaveBeenCalledTimes(1);
    const [payload] = error.mock.calls[0];
    expect(payload).toMatchObject({
      action: 'catalog.product.create',
      reason: 'unexpected_error',
      outcome: 'failure',
      correlationId: null,
      err: boom,
    });
  });

  it('null correlationId when no context is set', () => {
    const { pino, info } = buildPino();
    const log = new BusinessActionLogger(pino);

    log.success({ action: 'catalog.boot' });

    expect(info.mock.calls[0][0].correlationId).toBeNull();
  });

  it('forCorrelationId() emits with the provided correlationId regardless of context', () => {
    const { pino, info } = buildPino();
    const log = new BusinessActionLogger(pino);

    const scoped = log.forCorrelationId('worker-corr');
    CorrelationContext.run('http-corr', () => {
      scoped.success({ action: 'audit.event.persisted', eventId: 'e-1' });
    });

    expect(info.mock.calls[0][0]).toEqual({
      action: 'audit.event.persisted',
      eventId: 'e-1',
      outcome: 'success',
      correlationId: 'worker-corr',
    });
  });
});
