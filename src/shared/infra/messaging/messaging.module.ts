import { Global, Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { AppConfigService } from '../../config/app-config.service';
import { AUDIT_DLQ, AUDIT_DLX } from '../../../modules/audit/infra/messaging/audit-routing';

@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        uri: config.rabbitmq.url,
        exchanges: [
          {
            name: config.rabbitmq.exchange,
            type: 'topic',
            options: { durable: true },
          },
          {
            name: AUDIT_DLX,
            type: 'topic',
            options: { durable: true },
          },
        ],
        queues: [
          {
            name: AUDIT_DLQ,
            exchange: AUDIT_DLX,
            routingKey: '#',
            createQueueIfNotExists: true,
            options: { durable: true },
          },
        ],
        connectionInitOptions: { wait: false },
        enableControllerDiscovery: true,
      }),
    }),
  ],
  exports: [RabbitMQModule],
})
export class MessagingModule {}
