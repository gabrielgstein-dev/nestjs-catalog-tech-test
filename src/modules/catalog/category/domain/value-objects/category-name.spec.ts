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
});
