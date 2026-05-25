import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { join } from 'node:path';

export interface CatalogTestBed {
  postgres: StartedPostgreSqlContainer;
  dataSource: DataSource;
  stop(): Promise<void>;
}

export async function startCatalogTestBed(): Promise<CatalogTestBed> {
  const postgres = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('catalog')
    .withUsername('catalog')
    .withPassword('catalog')
    .start();

  const dataSource = new DataSource({
    type: 'postgres',
    host: postgres.getHost(),
    port: postgres.getMappedPort(5432),
    username: postgres.getUsername(),
    password: postgres.getPassword(),
    database: postgres.getDatabase(),
    entities: [
      join(__dirname, '../../src/modules/**/infra/entities/*.entity.ts'),
      join(__dirname, '../../src/shared/infra/**/*.entity.ts'),
    ],
    migrations: [join(__dirname, '../../src/shared/infra/database/migrations/*.ts')],
    synchronize: false,
    logging: ['error'],
  });

  await dataSource.initialize();
  await dataSource.runMigrations();

  return {
    postgres,
    dataSource,
    async stop() {
      await dataSource.destroy();
      await postgres.stop();
    },
  };
}

export async function truncateCatalog(dataSource: DataSource): Promise<void> {
  await dataSource.query(`DELETE FROM product_category`);
  await dataSource.query(`DELETE FROM product_attribute`);
  await dataSource.query(`DELETE FROM product`);
  await dataSource.query(`DELETE FROM category`);
}
