import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DOMAIN_EVENT_PUBLISHER } from '../../application/domain-event-publisher.port';
import { OutboxEntity } from './outbox.entity';
import { OutboxEventPublisher } from './outbox-event.publisher';
import { OutboxRelay } from './outbox-relay.service';
import { DEFAULT_OUTBOX_RELAY_OPTIONS, OUTBOX_RELAY_OPTIONS } from './outbox-relay.constants';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEntity])],
  providers: [
    OutboxEventPublisher,
    { provide: DOMAIN_EVENT_PUBLISHER, useExisting: OutboxEventPublisher },
    { provide: OUTBOX_RELAY_OPTIONS, useValue: DEFAULT_OUTBOX_RELAY_OPTIONS },
    OutboxRelay,
  ],
  exports: [DOMAIN_EVENT_PUBLISHER, OutboxRelay],
})
export class OutboxModule {}
