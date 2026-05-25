import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UnitOfWork } from '../../application/unit-of-work.port';
import { TransactionContext } from '../../application/transaction-context';

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (TransactionContext.get()) {
      return fn();
    }
    return this.dataSource.transaction(async (manager) => {
      return TransactionContext.run(manager, fn);
    });
  }
}
