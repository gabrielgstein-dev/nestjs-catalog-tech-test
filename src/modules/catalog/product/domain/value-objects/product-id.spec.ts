import { ProductId } from './product-id';

describe('ProductId', () => {
  it('trims and stores the value', () => {
    expect(ProductId.of('  abc  ').value).toBe('abc');
  });

  it('rejects empty values', () => {
    expect(() => ProductId.of('')).toThrow();
    expect(() => ProductId.of('   ')).toThrow();
  });

  it('compares by value', () => {
    expect(ProductId.of('x').equals(ProductId.of('x'))).toBe(true);
    expect(ProductId.of('x').equals(ProductId.of('y'))).toBe(false);
  });

  it('exposes its value via toString (used in log envelopes)', () => {
    expect(ProductId.of('abc').toString()).toBe('abc');
    expect(String(ProductId.of('abc'))).toBe('abc');
  });
});
