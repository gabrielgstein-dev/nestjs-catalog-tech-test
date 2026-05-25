import { AsyncLocalStorage } from 'node:async_hooks';
import type { EntityManager } from 'typeorm';

const storage = new AsyncLocalStorage<EntityManager>();

export const TransactionContext = {
  run<T>(manager: EntityManager, fn: () => Promise<T>): Promise<T> {
    return storage.run(manager, fn);
  },

  get(): EntityManager | undefined {
    return storage.getStore();
  },
};
