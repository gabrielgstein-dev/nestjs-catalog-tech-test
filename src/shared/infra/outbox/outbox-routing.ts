/**
 * Routing convention for catalog domain events.
 *
 * Domain event names follow `<bounded-context>.<aggregate>.<verb>` (e.g.
 * `catalog.product.created`). We reuse the event name as routing key so that
 * audit consumers can bind topic patterns like `catalog.#` and infer the
 * aggregate type from the second segment.
 */
export const routingKeyFor = (eventName: string): string => eventName;

/**
 * Aggregate type derived from the event name (e.g. `catalog.product`).
 * Falls back to `'unknown'` when the format is not as expected — we never
 * want a stray event to crash persistence.
 */
export const aggregateTypeFor = (eventName: string): string => {
  const parts = eventName.split('.');
  if (parts.length < 2) {
    return 'unknown';
  }
  return parts.slice(0, parts.length - 1).join('.');
};
