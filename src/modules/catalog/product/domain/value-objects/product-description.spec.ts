import { ProductDescription } from './product-description';

describe('ProductDescription', () => {
  it('returns null for undefined input', () => {
    const d = ProductDescription.of(undefined);
    expect(d.value).toBeNull();
    expect(d.isEmpty()).toBe(true);
  });

  it('returns null for explicit null', () => {
    expect(ProductDescription.of(null).value).toBeNull();
  });

  it('returns null for empty/whitespace-only strings', () => {
    expect(ProductDescription.of('').value).toBeNull();
    expect(ProductDescription.of('   ').value).toBeNull();
  });

  it('trims and stores valid values', () => {
    expect(ProductDescription.of('  hello  ').value).toBe('hello');
  });

  it('rejects values exceeding max length', () => {
    const long = 'x'.repeat(ProductDescription.MAX_LENGTH + 1);
    expect(() => ProductDescription.of(long)).toThrow();
  });

  it('rejects non-string non-null input at the runtime boundary (defensive vs JS callers)', () => {
    expect(() => ProductDescription.of(123 as unknown as string)).toThrow(/must be a string/);
  });

  it('compares by value', () => {
    expect(ProductDescription.of('a').equals(ProductDescription.of('a'))).toBe(true);
    expect(ProductDescription.of(null).equals(ProductDescription.of(null))).toBe(true);
    expect(ProductDescription.of('a').equals(ProductDescription.of(null))).toBe(false);
  });
});
