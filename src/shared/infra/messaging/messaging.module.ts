import { Global, Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { AppConfigService } from '../../config/app-config.service';

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
        ],
        connectionInitOptions: { wait: true, timeout: 30000 },
        enableControllerDiscovery: true,
      }),
    }),
  ],
  exports: [RabbitMQModule],
})
export class MessagingModule {}
