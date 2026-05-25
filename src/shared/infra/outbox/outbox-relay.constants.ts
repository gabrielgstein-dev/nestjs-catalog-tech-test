export const OUTBOX_RELAY_OPTIONS = Symbol('OutboxRelayOptions');

export interface OutboxRelayOptions {
  /** Milliseconds between polls. */
  pollIntervalMs: number;
  /** Max rows claimed per tick. */
  batchSize: number;
  /** Hard cap on attempts before the row is flagged FAILED. 0 means never give up. */
  maxAttempts: number;
}

export const DEFAULT_OUTBOX_RELAY_OPTIONS: OutboxRelayOptions = {
  pollIntervalMs: 500,
  batchSize: 50,
  maxAttempts: 0,
};
