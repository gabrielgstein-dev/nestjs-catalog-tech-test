import { HealthController } from './health.controller';
import type { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import type { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

type HealthIndicatorFn = () => Promise<Record<string, { status: 'up' | 'down' }>>;

const buildHealth = (overrides?: { connected?: boolean; dbUp?: boolean }) => {
  const connected = overrides?.connected ?? true;
  const dbUp = overrides?.dbUp ?? true;

  const db = {
    pingCheck: jest.fn(async (name: string) => {
      if (!dbUp) {
        throw new Error('db down');
      }
      return { [name]: { status: 'up' } };
    }),
  } as unknown as TypeOrmHealthIndicator;

  const health = {
    check: jest.fn(async (indicators: HealthIndicatorFn[]) => {
      const settled = await Promise.allSettled(indicators.map((fn) => fn()));
      const info: Record<string, { status: 'up' | 'down' }> = {};
      const errors: Record<string, { status: 'up' | 'down' }> = {};
      let allUp = true;
      for (const r of settled) {
        if (r.status === 'fulfilled') {
          for (const [k, v] of Object.entries(r.value)) {
            if (v.status === 'up') info[k] = v;
            else {
              errors[k] = v;
              allUp = false;
            }
          }
        } else {
          allUp = false;
        }
      }
      return {
        status: allUp ? 'ok' : 'error',
        info,
        error: errors,
        details: { ...info, ...errors },
      };
    }),
  } as unknown as HealthCheckService;

  const amqp = { connected } as unknown as AmqpConnection;

  return { controller: new HealthController(health, db, amqp), db, health, amqp };
};

describe('HealthController', () => {
  it('returns status=ok when both DB and RabbitMQ are up', async () => {
    const { controller, db } = buildHealth({ connected: true, dbUp: true });

    const res = await controller.check();

    expect(db.pingCheck).toHaveBeenCalledWith('database', { timeout: 1500 });
    expect(res.status).toBe('ok');
    expect(res.info?.database?.status).toBe('up');
    expect(res.info?.rabbitmq?.status).toBe('up');
  });

  it('reports rabbitmq down when AmqpConnection.connected is false', async () => {
    const { controller } = buildHealth({ connected: false, dbUp: true });

    const res = await controller.check();

    expect(res.status).toBe('error');
    expect(res.info?.database?.status).toBe('up');
    expect(res.error?.rabbitmq?.status).toBe('down');
  });

  it('reports error when DB ping rejects', async () => {
    const { controller } = buildHealth({ connected: true, dbUp: false });

    const res = await controller.check();

    expect(res.status).toBe('error');
    expect(res.info?.rabbitmq?.status).toBe('up');
    expect(res.info?.database).toBeUndefined();
  });
});
