import { UnitOfWork } from '../unit-of-work.port';

export class PassThroughUnitOfWork implements UnitOfWork {
  async run<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}
