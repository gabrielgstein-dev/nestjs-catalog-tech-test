import { UnitOfWork } from '../unit-of-work.port';

/**
 * Test double: runs the function with no transactional boundary.
 *
 * Use in unit tests where the in-memory publisher and repository do not
 * require a real EntityManager. Integration tests must use the real
 * {@link TypeOrmUnitOfWork} so atomicity assertions are meaningful.
 */
export class PassThroughUnitOfWork implements UnitOfWork {
  async run<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}
