import { BusinessActionLogger } from './business-action.logger';
import { runWithActionLog } from './run-with-action-log';
import { DomainError } from '../../domain/domain-error';

class FakeDomainError extends DomainError {
  readonly code = 'fake.boom';
  constructor() {
    super('boom');
  }
}

const buildLogger = () => {
  const success = jest.fn();
  const failure = jest.fn();
  const error = jest.fn();
  return {
    log: { success, failure, error } as unknown as BusinessActionLogger,
    success,
    failure,
    error,
  };
};

describe('runWithActionLog', () => {
  it('emits success when fn resolves and returns its result', async () => {
    const { log, success } = buildLogger();
    const out = await runWithActionLog(
      log,
      { action: 'a.b', productId: 'pid' },
      async () => 'ok',
    );
    expect(out).toBe('ok');
    expect(success).toHaveBeenCalledWith({ action: 'a.b', productId: 'pid' });
  });

  it('emits failure with err.code as reason when DomainError is thrown', async () => {
    const { log, failure } = buildLogger();
    await expect(
      runWithActionLog(log, { action: 'a.b' }, async () => {
        throw new FakeDomainError();
      }),
    ).rejects.toBeInstanceOf(FakeDomainError);
    expect(failure).toHaveBeenCalledWith({ action: 'a.b', reason: 'fake.boom' });
  });

  it('emits error with reason=unexpected_error for non-domain errors', async () => {
    const { log, error } = buildLogger();
    const boom = new Error('oops');
    await expect(
      runWithActionLog(log, { action: 'a.b' }, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(error).toHaveBeenCalledWith({ action: 'a.b', reason: 'unexpected_error', err: boom });
  });
});
