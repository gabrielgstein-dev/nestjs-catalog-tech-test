import { Attribute } from './attribute';
import { AttributeCollection } from './attribute-collection';
import { DuplicateAttributeKeyError } from '../errors/duplicate-attribute-key.error';
import { AttributeKeyNotFoundError } from '../errors/attribute-key-not-found.error';

const attr = (k: string, v: string) => Attribute.of(k, v);

describe('AttributeCollection', () => {
  it('starts empty', () => {
    const c = AttributeCollection.empty();
    expect(c.size).toBe(0);
    expect(c.isEmpty()).toBe(true);
    expect(c.toArray()).toEqual([]);
  });

  it('builds from an array', () => {
    const c = AttributeCollection.of([attr('cor', 'azul'), attr('material', 'metal')]);
    expect(c.size).toBe(2);
    expect(c.has('cor')).toBe(true);
    expect(c.get('material')?.value).toBe('metal');
  });

  it('rejects duplicate keys at construction', () => {
    expect(() => AttributeCollection.of([attr('cor', 'a'), attr('cor', 'b')])).toThrow(
      DuplicateAttributeKeyError,
    );
  });

  describe('add', () => {
    it('returns a new collection with the attribute', () => {
      const c1 = AttributeCollection.empty();
      const c2 = c1.add(attr('cor', 'azul'));
      expect(c1.size).toBe(0);
      expect(c2.size).toBe(1);
      expect(c2.get('cor')?.value).toBe('azul');
    });

    it('throws DuplicateAttributeKeyError when key already exists', () => {
      const c = AttributeCollection.empty().add(attr('cor', 'azul'));
      expect(() => c.add(attr('cor', 'verde'))).toThrow(DuplicateAttributeKeyError);
    });
  });

  describe('update', () => {
    it('replaces the value for an existing key', () => {
      const c1 = AttributeCollection.empty().add(attr('cor', 'azul'));
      const c2 = c1.update(attr('cor', 'verde'));
      expect(c1.get('cor')?.value).toBe('azul');
      expect(c2.get('cor')?.value).toBe('verde');
    });

    it('throws AttributeKeyNotFoundError when key is missing', () => {
      expect(() => AttributeCollection.empty().update(attr('cor', 'x'))).toThrow(
        AttributeKeyNotFoundError,
      );
    });
  });

  describe('remove', () => {
    it('returns a new collection without the key', () => {
      const c1 = AttributeCollection.empty().add(attr('cor', 'azul')).add(attr('material', 'pano'));
      const c2 = c1.remove('cor');
      expect(c1.size).toBe(2);
      expect(c2.size).toBe(1);
      expect(c2.has('cor')).toBe(false);
      expect(c2.has('material')).toBe(true);
    });

    it('throws AttributeKeyNotFoundError when key is missing', () => {
      expect(() => AttributeCollection.empty().remove('cor')).toThrow(AttributeKeyNotFoundError);
    });
  });
});
