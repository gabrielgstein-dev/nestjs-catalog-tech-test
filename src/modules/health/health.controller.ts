import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly amqp: AmqpConnection,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness/readiness — Postgres ping + RabbitMQ channel connected.',
  })
  @ApiOkResponse({ description: 'All dependencies up.' })
  @ApiServiceUnavailableResponse({ description: 'One or more dependencies are down.' })
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
