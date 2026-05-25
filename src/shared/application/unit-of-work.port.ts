export const UNIT_OF_WORK = Symbol('UnitOfWork');

export interface UnitOfWork {
  run<T>(fn: () => Promise<T>): Promise<T>;
}
