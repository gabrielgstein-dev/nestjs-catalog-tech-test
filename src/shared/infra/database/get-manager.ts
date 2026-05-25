import { DataSource, EntityManager } from 'typeorm';
import { TransactionContext } from '../../application/transaction-context';

export function getAmbientManager(dataSource: DataSource): EntityManager {
  return TransactionContext.get() ?? dataSource.manager;
}
