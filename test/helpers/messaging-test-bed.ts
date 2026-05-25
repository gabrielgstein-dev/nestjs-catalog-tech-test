import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { INestApplication, Provider } from '@nestjs/common';
import { CommandBus as commandBusToken, type CommandBus } from '@nestjs/cqrs';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { DataSource } from 'typeorm';

export interface MessagingTestBed {
  app: INestApplication;
  postgres: StartedPostgreSqlContainer;
  rabbit: StartedRabbitMQContainer;
  pauseRabbit(): void;
  unpauseRabbit(): void;
  truncate(): Promise<void>;
  getCommandBus(): CommandBus;
  getDataSource(): DataSource;
  close(): Promise<void>;
}

export interface StartMessagingTestBedOpts {
  overrideProviders?: Array<{ provide: unknown; useValue: unknown } & Partial<Provider>>;
  pollIntervalMs?: number;
}

export const startMessagingTestBed = async (
  opts: StartMessagingTestBedOpts = {},
): Promise<MessagingTestBed> => {
  const postgres = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('catalog')
    .withUsername('catalog')
    .withPassword('catalog')
    .start();

  const rabbit = await new RabbitMQContainer('rabbitmq:3.13-management-alpine').start();

  process.env.NODE_ENV = 'test';
  process.env.PORT = '3010';
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
  const { OUTBOX_RELAY_OPTIONS } = await import(
    '../../src/shared/infra/outbox/outbox-relay.constants'
  );

  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OUTBOX_RELAY_OPTIONS)
    .useValue({
      pollIntervalMs: opts.pollIntervalMs ?? 100,
      batchSize: 50,
      maxAttempts: 0,
    });

  for (const provider of opts.overrideProviders ?? []) {
    builder = builder.overrideProvider(provider.provide).useValue(provider.useValue);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  await app.init();

  const dataSource = app.get(DataSource);
  const amqp = app.get(AmqpConnection);

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (amqp.channel && amqp.connected) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!amqp.channel || !amqp.connected) {
    await app.close();
    await rabbit.stop();
    await postgres.stop();
    throw new Error('AMQP did not connect within 15s — test bed bootstrap failed');
  }

  const truncate = async () => {
    await dataSource.query(`DELETE FROM audit_log`);
    await dataSource.query(`DELETE FROM processed_event`);
    await dataSource.query(`DELETE FROM outbox`);
    await dataSource.query(`DELETE FROM product_category`);
    await dataSource.query(`DELETE FROM product_attribute`);
    await dataSource.query(`DELETE FROM product`);
    await dataSource.query(`DELETE FROM category`);
  };

  const containerId = rabbit.getId();
  let paused = false;
  const pauseRabbit = () => {
    if (paused) return;
    execSync(`docker pause ${containerId}`, { stdio: 'pipe' });
    paused = true;
  };
  const unpauseRabbit = () => {
    if (!paused) return;
    execSync(`docker unpause ${containerId}`, { stdio: 'pipe' });
    paused = false;
  };

  return {
    app,
    postgres,
    rabbit,
    pauseRabbit,
    unpauseRabbit,
    truncate,
    getCommandBus: () => app.get<CommandBus>(commandBusToken),
    getDataSource: () => dataSource,
    async close() {
      unpauseRabbit();
      await app.close();
      await rabbit.stop();
      await postgres.stop();
    },
  };
};

export const waitFor = async <T>(
  fn: () => Promise<T | null | undefined>,
  opts: { timeoutMs?: number; intervalMs?: number; label?: string } = {},
): Promise<T> => {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const intervalMs = opts.intervalMs ?? 100;
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v) return v;
    last = v;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `waitFor${opts.label ? ` (${opts.label})` : ''} timed out after ${timeoutMs}ms; last=${JSON.stringify(last)}`,
  );
};
