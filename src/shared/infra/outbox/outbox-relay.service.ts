import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { DataSource, EntityManager } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { AppConfigService } from '../../config/app-config.service';
import { CORRELATION_ID_HEADER } from '../http/correlation-id.constants';
import { OUTBOX_STATUS } from './outbox.entity';
import { routingKeyFor } from './outbox-routing';
import {
  DEFAULT_OUTBOX_RELAY_OPTIONS,
  OUTBOX_RELAY_OPTIONS,
  OutboxRelayOptions,
} from './outbox-relay.constants';

interface ClaimedRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
  attempts: number;
  correlation_id: string | null;
}

@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;
  private currentTick: Promise<void> | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly amqp: AmqpConnection,
    private readonly config: AppConfigService,
    private readonly logger: PinoLogger,
    @Inject(OUTBOX_RELAY_OPTIONS) private readonly options: OutboxRelayOptions,
  ) {
    this.logger.setContext(OutboxRelay.name);
  }

  onModuleInit(): void {
    this.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  /** Visible for tests: triggers a tick synchronously. */
  async drain(): Promise<number> {
    return this.tick();
  }

  private start(): void {
    if (this.timer) {
      return;
    }
    this.stopped = false;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.stopped) {
      return;
    }
    this.timer = setTimeout(() => {
      void this.runTick();
    }, this.options.pollIntervalMs);
    this.timer.unref?.();
  }

  private async runTick(): Promise<void> {
    if (this.running || this.stopped) {
      return;
    }
    this.running = true;
    this.currentTick = this.tick()
      .then(
        () => undefined,
        (err: unknown) => {
          this.logger.error({ err }, 'outbox tick crashed');
        },
      )
      .finally(() => {
        this.running = false;
        this.currentTick = null;
        this.scheduleNext();
      });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.currentTick) {
      await this.currentTick.catch(() => undefined);
    }
  }

  private async tick(): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await this.claim(manager);
      if (rows.length === 0) {
        return 0;
      }

      let published = 0;
      for (const row of rows) {
        const ok = await this.publishRow(row);
        if (ok) {
          await this.markProcessed(manager, row.id);
          published++;
        } else {
          await this.markFailedAttempt(manager, row);
        }
      }
      return published;
    });
  }

  private async claim(manager: EntityManager): Promise<ClaimedRow[]> {
    return manager.query(
      `SELECT id, aggregate_type, aggregate_id, event_type, payload, occurred_at, attempts, correlation_id
         FROM outbox
        WHERE status = $1
        ORDER BY occurred_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED`,
      [OUTBOX_STATUS.PENDING, this.options.batchSize],
    );
  }

  private async publishRow(row: ClaimedRow): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'x-event-id': row.id };
      if (row.correlation_id) {
        headers[CORRELATION_ID_HEADER] = row.correlation_id;
      }
      const ok = await this.amqp.publish(
        this.config.rabbitmq.exchange,
        routingKeyFor(row.event_type),
        row.payload,
        {
          persistent: true,
          messageId: row.id,
          timestamp: Math.floor(row.occurred_at.getTime() / 1000),
          headers,
        },
      );
      if (!ok) {
        this.logger.warn({ outboxId: row.id }, 'broker rejected publish (buffer full?)');
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(
        { err, outboxId: row.id, eventType: row.event_type },
        'outbox publish failed — will retry next tick',
      );
      return false;
    }
  }

  private async markProcessed(manager: EntityManager, id: string): Promise<void> {
    await manager.query(
      `UPDATE outbox
          SET status = $1,
              processed_at = now(),
              last_error = NULL
        WHERE id = $2`,
      [OUTBOX_STATUS.PROCESSED, id],
    );
  }

  private async markFailedAttempt(manager: EntityManager, row: ClaimedRow): Promise<void> {
    const nextAttempts = row.attempts + 1;
    const giveUp = this.options.maxAttempts > 0 && nextAttempts >= this.options.maxAttempts;
    const errorMsg = `publish attempt ${nextAttempts} failed`;

    if (giveUp) {
      await manager.query(
        `UPDATE outbox
            SET status = $1,
                attempts = $2,
                last_error = $3
          WHERE id = $4`,
        [OUTBOX_STATUS.FAILED, nextAttempts, errorMsg, row.id],
      );
      return;
    }

    await manager.query(
      `UPDATE outbox
          SET attempts = $1,
              last_error = $2
        WHERE id = $3`,
      [nextAttempts, errorMsg, row.id],
    );
  }
}

export const buildDefaultOutboxRelayOptions = (): OutboxRelayOptions => ({
  ...DEFAULT_OUTBOX_RELAY_OPTIONS,
});
