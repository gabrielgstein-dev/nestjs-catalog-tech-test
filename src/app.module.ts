import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AppConfigModule } from './shared/config/config.module';
import { AppLoggerModule } from './shared/infra/logging/logger.module';
import { CorrelationIdMiddleware } from './shared/infra/http/correlation-id.middleware';
import { DatabaseModule } from './shared/infra/database/database.module';
import { MessagingModule } from './shared/infra/messaging/messaging.module';
import { OutboxModule } from './shared/infra/outbox/outbox.module';
import { HealthModule } from './modules/health/health.module';
import { SkeletonModule } from './modules/skeleton/skeleton.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    CqrsModule.forRoot(),
    DatabaseModule,
    MessagingModule,
    OutboxModule,
    HealthModule,
    SkeletonModule,
    CatalogModule,
    AuditModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
