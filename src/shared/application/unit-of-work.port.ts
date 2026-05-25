export const UNIT_OF_WORK = Symbol('UnitOfWork');

export interface UnitOfWork {
  /**
   * Runs `fn` inside a single database transaction. The current EntityManager is
   * exposed to repositories and to the outbox publisher via TransactionContext,
   * so the domain mutation and the outbox row are committed atomically.
   */
  run<T>(fn: () => Promise<T>): Promise<T>;
}
