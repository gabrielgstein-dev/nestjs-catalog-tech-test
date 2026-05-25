import { aggregateTypeFor, routingKeyFor } from './outbox-routing';

describe('outbox-routing helpers', () => {
  describe('routingKeyFor', () => {
    it('returns the event name unchanged (topic routing strategy)', () => {
      expect(routingKeyFor('catalog.product.created')).toBe('catalog.product.created');
    });
  });

  describe('aggregateTypeFor', () => {
    it('strips the last segment (the action) and keeps the aggregate qualifier', () => {
      expect(aggregateTypeFor('catalog.product.created')).toBe('catalog.product');
      expect(aggregateTypeFor('catalog.category.renamed')).toBe('catalog.category');
    });

    it('returns "unknown" when the event name has no dot (defensive against malformed events)', () => {
      expect(aggregateTypeFor('malformed')).toBe('unknown');
      expect(aggregateTypeFor('')).toBe('unknown');
    });

    it('handles two-segment event names by keeping the first segment as the aggregate', () => {
      expect(aggregateTypeFor('a.b')).toBe('a');
    });
  });
});
