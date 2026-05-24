import { Attribute } from './attribute';
import { DuplicateAttributeKeyError } from '../errors/duplicate-attribute-key.error';
import { AttributeKeyNotFoundError } from '../errors/attribute-key-not-found.error';

/**
 * Immutable collection of attributes keyed by `key`. All mutating-looking
 * methods return a NEW collection — instances are values, not containers.
 * Enforces the structural invariant: a product cannot hold two attributes
 * with the same key.
 */
export class AttributeCollection {
  private readonly byKey: ReadonlyMap<string, Attribute>;

  private constructor(byKey: ReadonlyMap<string, Attribute>) {
    this.byKey = byKey;
  }

  static empty(): AttributeCollection {
    return new AttributeCollection(new Map());
  }

  static of(attributes: ReadonlyArray<Attribute>): AttributeCollection {
    const map = new Map<string, Attribute>();
    for (const attr of attributes) {
      if (map.has(attr.key)) {
        throw new DuplicateAttributeKeyError(attr.key);
      }
      map.set(attr.key, attr);
    }
    return new AttributeCollection(map);
  }

  get size(): number {
    return this.byKey.size;
  }

  isEmpty(): boolean {
    return this.byKey.size === 0;
  }

  has(key: string): boolean {
    return this.byKey.has(key);
  }

  get(key: string): Attribute | undefined {
    return this.byKey.get(key);
  }

  toArray(): Attribute[] {
    return Array.from(this.byKey.values());
  }

  add(attribute: Attribute): AttributeCollection {
    if (this.byKey.has(attribute.key)) {
      throw new DuplicateAttributeKeyError(attribute.key);
    }
    const next = new Map(this.byKey);
    next.set(attribute.key, attribute);
    return new AttributeCollection(next);
  }

  update(attribute: Attribute): AttributeCollection {
    if (!this.byKey.has(attribute.key)) {
      throw new AttributeKeyNotFoundError(attribute.key);
    }
    const next = new Map(this.byKey);
    next.set(attribute.key, attribute);
    return new AttributeCollection(next);
  }

  remove(key: string): AttributeCollection {
    if (!this.byKey.has(key)) {
      throw new AttributeKeyNotFoundError(key);
    }
    const next = new Map(this.byKey);
    next.delete(key);
    return new AttributeCollection(next);
  }
}
