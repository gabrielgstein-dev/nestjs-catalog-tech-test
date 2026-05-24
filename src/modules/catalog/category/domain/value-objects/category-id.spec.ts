import { CategoryId } from './category-id';

describe('CategoryId', () => {
  it('trims whitespace and stores the value', () => {
    const id = CategoryId.of('  abc  ');
    expect(id.value).toBe('abc');
    expect(id.toString()).toBe('abc');
  });

  it('rejects empty strings', () => {
    expect(() => CategoryId.of('')).toThrow();
    expect(() => CategoryId.of('   ')).toThrow();
  });

  it('compares by value', () => {
    expect(CategoryId.of('a').equals(CategoryId.of('a'))).toBe(true);
    expect(CategoryId.of('a').equals(CategoryId.of('b'))).toBe(false);
  });
});
