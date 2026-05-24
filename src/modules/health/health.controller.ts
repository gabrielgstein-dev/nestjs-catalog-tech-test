import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly amqp: AmqpConnection,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1500 }),
      async () => {
        const connected = this.amqp.connected;
        if (!connected) {
          return { rabbitmq: { status: 'down' } };
        }
        return { rabbitmq: { status: 'up' } };
      },
    ]);
  }
}
