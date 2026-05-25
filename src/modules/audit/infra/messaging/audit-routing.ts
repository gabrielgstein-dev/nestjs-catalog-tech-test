// Single source of truth for the catalog topology — referenced by both
// MessagingModule (declarative wiring) and AuditConsumer's @RabbitSubscribe
// decorator (parse-time literal). The env var RABBITMQ_EXCHANGE still drives
// the producer-side exchange name in AppConfigService for prod flexibility,
// but consumer-side bindings use this constant to guarantee parse/runtime
// agreement (decorator metadata cannot be resolved via DI).
export const CATALOG_EXCHANGE = 'catalog.events';
export const AUDIT_QUEUE = 'audit.events.q';
export const AUDIT_DLQ = 'audit.events.dlq';
export const AUDIT_DLX = 'catalog.events.dlx';
export const AUDIT_CONSUMER_NAME = 'audit';
export const AUDIT_MAX_ATTEMPTS = 5;
export const CATALOG_TOPIC_BINDING = 'catalog.#';
