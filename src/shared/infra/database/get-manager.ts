import { DataSource, EntityManager } from 'typeorm';
import { TransactionContext } from '../../application/transaction-context';

/**
 * Returns the ambient EntityManager when running inside a Unit of Work,
 * falling back to the DataSource's default manager (auto-commit) otherwise.
 */
export function getAmbientManager(dataSource: DataSource): EntityManager {
  return TransactionContext.get() ?? dataSource.manager;
}
