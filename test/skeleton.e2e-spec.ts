import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { DataSource } from 'typeorm';
import { join } from 'node:path';

jest.setTimeout(180_000);

describe('Walking skeleton (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let rabbit: StartedRabbitMQContainer;
  let app: INestApplication;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('catalog')
      .withUsername('catalog')
      .withPassword('catalog')
      .start();

    rabbit = await new RabbitMQContainer('rabbitmq:3.13-management-alpine').start();

    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.LOG_LEVEL = 'info';
    process.env.DB_HOST = postgres.getHost();
    process.env.DB_PORT = String(postgres.getMappedPort(5432));
    process.env.DB_USER = postgres.getUsername();
    process.env.DB_PASSWORD = postgres.getPassword();
    process.env.DB_NAME = postgres.getDatabase();
    process.env.RABBITMQ_URL = rabbit.getAmqpUrl();
    process.env.RABBITMQ_EXCHANGE = 'catalog.events';

    const migrationDs = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST!,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_NAME!,
      migrations: [join(__dirname, '../src/shared/infra/database/migrations/*.ts')],
      entities: [join(__dirname, '../src/modules/**/infra/entities/*.entity.ts')],
      synchronize: false,
    });
    await migrationDs.initialize();
    await migrationDs.runMigrations();
    await migrationDs.destroy();

    const { AppModule } = await import('../src/app.module');
    const { Logger } = await import('nestjs-pino');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await rabbit?.stop();
    await postgres?.stop();
  });

  it('persists a ping, publishes, consumes, and exposes ack via GET', async () => {
    const correlationId = 'e2e-corr-1234567890';

    const createRes = await request(app.getHttpServer())
      .post('/skeleton/ping')
      .set('x-correlation-id', correlationId)
      .send({ payload: 'hello' })
      .expect(201);

    expect(createRes.body).toMatchObject({ correlationId });
    expect(createRes.body.id).toEqual(expect.any(String));
    expect(createRes.headers['x-correlation-id']).toBe(correlationId);

    const pingId: string = createRes.body.id;

    let ack: { status: string; ackedAt: string } | null = null;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer()).get(`/skeleton/ping/${pingId}`).expect(200);
      if (res.body.ack) {
        ack = res.body.ack;
        expect(res.body).toMatchObject({
          id: pingId,
          correlationId,
          payload: 'hello',
        });
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    expect(ack).not.toBeNull();
    expect(ack?.status).toBe('processed');
  });

  it('exposes /health as up for DB and RabbitMQ', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info?.database?.status).toBe('up');
    expect(res.body.info?.rabbitmq?.status).toBe('up');
  });

  it('returns 404 when fetching a non-existent ping', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const res = await request(app.getHttpServer()).get(`/skeleton/ping/${missing}`).expect(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('returns 400 when the ping id is not a UUID', async () => {
    await request(app.getHttpServer()).get('/skeleton/ping/not-a-uuid').expect(400);
  });
});
