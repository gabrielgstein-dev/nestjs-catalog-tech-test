import { CategoryName } from './category-name';

describe('CategoryName', () => {
  it('trims and stores the value', () => {
    expect(CategoryName.of('  Eletrônicos  ').value).toBe('Eletrônicos');
  });

  it('rejects empty/whitespace-only names', () => {
    expect(() => CategoryName.of('')).toThrow();
    expect(() => CategoryName.of('   ')).toThrow();
  });

  it('rejects names exceeding the max length', () => {
    const long = 'x'.repeat(CategoryName.MAX_LENGTH + 1);
    expect(() => CategoryName.of(long)).toThrow();
  });

  it('accepts names exactly at the max length', () => {
    const exact = 'x'.repeat(CategoryName.MAX_LENGTH);
    expect(CategoryName.of(exact).value).toBe(exact);
  });

  it('compares by value', () => {
    expect(CategoryName.of('a').equals(CategoryName.of('a'))).toBe(true);
    expect(CategoryName.of('a').equals(CategoryName.of('b'))).toBe(false);
  });

  it('is case-sensitive: "Eletronicos" !== "eletronicos"', () => {
    expect(CategoryName.of('Eletronicos').equals(CategoryName.of('eletronicos'))).toBe(false);
  });

  it('rejects non-string input at the runtime boundary (defensive vs JS callers)', () => {
    expect(() => CategoryName.of(42 as unknown as string)).toThrow(/must be a string/);
  });

  it('exposes its value via toString (used in log envelopes)', () => {
    expect(CategoryName.of('X').toString()).toBe('X');
  });
});
