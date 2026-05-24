import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';

describe('AppConfigService', () => {
  const buildConfig = (env: Record<string, string | number>) =>
    new AppConfigService(new ConfigService({ ...env }) as unknown as ConfigService);

  it('exposes typed database settings', () => {
    const svc = buildConfig({
      NODE_ENV: 'test',
      PORT: 4000,
      LOG_LEVEL: 'debug',
      DB_HOST: 'db',
      DB_PORT: 5432,
      DB_USER: 'u',
      DB_PASSWORD: 'p',
      DB_NAME: 'n',
      RABBITMQ_URL: 'amqp://x',
      RABBITMQ_EXCHANGE: 'ex',
    });

    expect(svc.port).toBe(4000);
    expect(svc.database).toEqual({
      host: 'db',
      port: 5432,
      username: 'u',
      password: 'p',
      database: 'n',
    });
    expect(svc.rabbitmq).toEqual({ url: 'amqp://x', exchange: 'ex' });
  });

  it('throws when a required env var is missing', () => {
    const svc = buildConfig({ NODE_ENV: 'test' });
    expect(() => svc.database).toThrow();
  });
});
