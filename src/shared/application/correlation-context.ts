import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<string>();

export const CorrelationContext = {
  run<T>(correlationId: string, fn: () => T): T {
    return storage.run(correlationId, fn);
  },

  get(): string | undefined {
    return storage.getStore();
  },
};
