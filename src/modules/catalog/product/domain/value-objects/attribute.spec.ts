import { Attribute } from './attribute';

describe('Attribute', () => {
  it('trims and stores key/value', () => {
    const a = Attribute.of('  cor  ', '  azul  ');
    expect(a.key).toBe('cor');
    expect(a.value).toBe('azul');
  });

  it('rejects empty key', () => {
    expect(() => Attribute.of('', 'x')).toThrow();
    expect(() => Attribute.of('   ', 'x')).toThrow();
  });

  it('rejects empty value', () => {
    expect(() => Attribute.of('cor', '')).toThrow();
    expect(() => Attribute.of('cor', '   ')).toThrow();
  });

  it('rejects key/value over max length', () => {
    expect(() => Attribute.of('x'.repeat(Attribute.KEY_MAX_LENGTH + 1), 'v')).toThrow();
    expect(() => Attribute.of('k', 'x'.repeat(Attribute.VALUE_MAX_LENGTH + 1))).toThrow();
  });

  it('withValue keeps the key and replaces the value', () => {
    const a = Attribute.of('cor', 'azul');
    const b = a.withValue('verde');
    expect(b.key).toBe('cor');
    expect(b.value).toBe('verde');
  });

  it('compares by key and value', () => {
    expect(Attribute.of('cor', 'azul').equals(Attribute.of('cor', 'azul'))).toBe(true);
    expect(Attribute.of('cor', 'azul').equals(Attribute.of('cor', 'verde'))).toBe(false);
    expect(Attribute.of('cor', 'azul').equals(Attribute.of('material', 'azul'))).toBe(false);
  });

  it('keys are case-sensitive: "Cor" and "cor" are distinct (collection treats them as different)', () => {
    expect(Attribute.of('Cor', 'azul').equals(Attribute.of('cor', 'azul'))).toBe(false);
  });
});
