import { ProductName } from './product-name';

describe('ProductName', () => {
  it('trims and stores the value', () => {
    expect(ProductName.of('  Cadeira gamer  ').value).toBe('Cadeira gamer');
  });

  it('rejects empty/whitespace-only names', () => {
    expect(() => ProductName.of('')).toThrow();
    expect(() => ProductName.of('   ')).toThrow();
  });

  it('rejects values exceeding max length', () => {
    const long = 'x'.repeat(ProductName.MAX_LENGTH + 1);
    expect(() => ProductName.of(long)).toThrow();
  });

  it('accepts values at exactly max length', () => {
    const exact = 'x'.repeat(ProductName.MAX_LENGTH);
    expect(ProductName.of(exact).value).toBe(exact);
  });

  it('compares by value', () => {
    expect(ProductName.of('a').equals(ProductName.of('a'))).toBe(true);
    expect(ProductName.of('a').equals(ProductName.of('b'))).toBe(false);
  });

  it('is case-sensitive: "Cadeira" !== "cadeira" (uniqueness checks downstream must agree)', () => {
    expect(ProductName.of('Cadeira').equals(ProductName.of('cadeira'))).toBe(false);
  });
});
