import { DomainError } from './domain-error';

class SampleError extends DomainError {
  readonly code = 'sample.error';
}

describe('DomainError', () => {
  it('is an Error subclass with name = class name', () => {
    const err = new SampleError('boom');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.name).toBe('SampleError');
    expect(err.message).toBe('boom');
    expect(err.code).toBe('sample.error');
  });

  it('preserves the prototype chain for instanceof checks', () => {
    const err: unknown = new SampleError('boom');
    expect(err instanceof SampleError).toBe(true);
    expect(err instanceof DomainError).toBe(true);
  });
});
