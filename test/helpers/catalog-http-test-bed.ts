import { execSync } from 'node:child_process';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { DataSource } from 'typeorm';

export interface CatalogHttpTestBed {
  app: INestApplication;
  server: ReturnType<INestApplication['getHttpServer']>;
  dataSource: DataSource;
  truncate(): Promise<void>;
  close(): Promise<void>;
}

export async function startCatalogHttpTestBed(): Promise<CatalogHttpTestBed> {
  const postgres: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('catalog')
    .withUsername('catalog')
    .withPassword('catalog')
    .start();
  const rabbit: StartedRabbitMQContainer = await new RabbitMQContainer(
    'rabbitmq:3.13-management-alpine',
  ).start();

  process.env.NODE_ENV = 'test';
  process.env.PORT = '3020';
  process.env.LOG_LEVEL = 'warn';
  process.env.DB_HOST = postgres.getHost();
  process.env.DB_PORT = String(postgres.getMappedPort(5432));
  process.env.DB_USER = postgres.getUsername();
  process.env.DB_PASSWORD = postgres.getPassword();
  process.env.DB_NAME = postgres.getDatabase();
  process.env.RABBITMQ_URL = rabbit.getAmqpUrl();
  process.env.RABBITMQ_EXCHANGE = 'catalog.events';

  const migrationDs = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    migrations: [join(__dirname, '../../src/shared/infra/database/migrations/*.ts')],
    entities: [
      join(__dirname, '../../src/modules/**/infra/entities/*.entity.ts'),
      join(__dirname, '../../src/shared/infra/**/*.entity.ts'),
    ],
    synchronize: false,
  });
  await migrationDs.initialize();
  await migrationDs.runMigrations();
  await migrationDs.destroy();

  const { AppModule } = await import('../../src/app.module');
  const { Logger } = await import('nestjs-pino');
  const { configureHttpApp } = await import('../../src/shared/infra/http/bootstrap-http');
  const { OUTBOX_RELAY_OPTIONS } = await import(
    '../../src/shared/infra/outbox/outbox-relay.constants'
  );

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OUTBOX_RELAY_OPTIONS)
    .useValue({ pollIntervalMs: 100, batchSize: 50, maxAttempts: 0 })
    .compile();

  const app = moduleRef.createNestApplication({ bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureHttpApp(app);
  app.enableShutdownHooks();
  await app.init();

  const dataSource = app.get(DataSource);
  const amqp = app.get(AmqpConnection);
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (amqp.channel && amqp.connected) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  const truncate = async (): Promise<void> => {
    await dataSource.query(`DELETE FROM audit_log`);
    await dataSource.query(`DELETE FROM processed_event`);
    await dataSource.query(`DELETE FROM outbox`);
    await dataSource.query(`DELETE FROM product_category`);
    await dataSource.query(`DELETE FROM product_attribute`);
    await dataSource.query(`DELETE FROM product`);
    await dataSource.query(`DELETE FROM category`);
  };

  return {
    app,
    server: app.getHttpServer(),
    dataSource,
    truncate,
    async close() {
      await app.close();
      try {
        execSync(`docker unpause ${rabbit.getId()}`, { stdio: 'pipe' });
      } catch {
        // ignore
      }
      await rabbit.stop();
      await postgres.stop();
    },
  };
}
