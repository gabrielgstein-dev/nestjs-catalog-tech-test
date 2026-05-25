import { ListProductsQuery } from './list-products.query';
import { ProductStatus } from '../../domain/value-objects/product-status';

describe('ListProductsQuery', () => {
  it('defaults limit=50, offset=0 and status=null when nothing is passed (controller fallback path)', () => {
    const q = new ListProductsQuery();
    expect(q.limit).toBe(50);
    expect(q.offset).toBe(0);
    expect(q.status).toBeNull();
  });

  it('honours explicit values including a status filter', () => {
    const q = new ListProductsQuery(25, 10, ProductStatus.ACTIVE);
    expect(q.limit).toBe(25);
    expect(q.offset).toBe(10);
    expect(q.status).toBe(ProductStatus.ACTIVE);
  });
});
