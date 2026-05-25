export const OUTBOX_RELAY_OPTIONS = Symbol('OutboxRelayOptions');

export interface OutboxRelayOptions {
  pollIntervalMs: number;
  batchSize: number;
  maxAttempts: number;
}

export const DEFAULT_OUTBOX_RELAY_OPTIONS: OutboxRelayOptions = {
  pollIntervalMs: 500,
  batchSize: 50,
  maxAttempts: 0,
};
