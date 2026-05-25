import { Global, Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { AppConfigService } from '../../config/app-config.service';
import { AUDIT_DLX } from '../../../modules/audit/infra/messaging/audit-routing';

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
        // Outbox decouples the write path from the broker: app boots and accepts
        // mutations even if RabbitMQ is unreachable. The relay drains pending
        // outbox rows as soon as a connection is (re)established.
        connectionInitOptions: { wait: false },
        enableControllerDiscovery: true,
      }),
    }),
  ],
  exports: [RabbitMQModule],
})
export class MessagingModule {}
