import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const valid = {
    DB_HOST: 'localhost',
    DB_USER: 'u',
    DB_PASSWORD: 'p',
    DB_NAME: 'n',
    RABBITMQ_URL: 'amqp://localhost',
    RABBITMQ_EXCHANGE: 'ex',
  };

  it('accepts a complete env', () => {
    const { error } = envValidationSchema.validate(valid, { abortEarly: false });
    expect(error).toBeUndefined();
  });

  it('rejects missing required keys', () => {
    const { error } = envValidationSchema.validate(
      { ...valid, RABBITMQ_URL: undefined },
      { abortEarly: false },
    );
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/RABBITMQ_URL/);
  });

  it('rejects an invalid RabbitMQ scheme', () => {
    const { error } = envValidationSchema.validate(
      { ...valid, RABBITMQ_URL: 'http://localhost' },
      { abortEarly: false },
    );
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/RABBITMQ_URL/);
  });
});
