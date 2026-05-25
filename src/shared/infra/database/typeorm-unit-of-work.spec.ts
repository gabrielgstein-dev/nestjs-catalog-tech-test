import { DataSource, EntityManager } from 'typeorm';
import { TransactionContext } from '../../application/transaction-context';
import { TypeOrmUnitOfWork } from './typeorm-unit-of-work';

describe('TypeOrmUnitOfWork', () => {
  it('opens a new transaction when no ambient TransactionContext exists and exposes the manager inside', async () => {
    const captured: EntityManager[] = [];
    const fakeManager = { id: 'mgr-1' } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        async <T>(cb: (m: EntityManager) => Promise<T>): Promise<T> => cb(fakeManager),
      ),
    } as unknown as DataSource;

    const uow = new TypeOrmUnitOfWork(dataSource);

    const result = await uow.run(async () => {
      const m = TransactionContext.get();
      if (m) captured.push(m);
      return 42;
    });

    expect(result).toBe(42);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(1);
    expect(captured[0]).toBe(fakeManager);
  });

  it('does NOT open a nested transaction when one is already active — reuses the ambient one', async () => {
    const dataSource = {
      transaction: jest.fn(),
    } as unknown as DataSource;
    const uow = new TypeOrmUnitOfWork(dataSource);
    const outerManager = { id: 'outer' } as unknown as EntityManager;

    const result = await TransactionContext.run(outerManager, () =>
      uow.run(async () => {
        // Ambient still visible inside the inner block.
        expect(TransactionContext.get()).toBe(outerManager);
        return 'inner-result';
      }),
    );

    expect(result).toBe('inner-result');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
