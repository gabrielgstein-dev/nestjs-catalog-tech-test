export class ProductName {
  static readonly MAX_LENGTH = 200;

  private constructor(public readonly value: string) {}

  static of(value: string): ProductName {
    if (typeof value !== 'string') {
      throw new Error('ProductName must be a string');
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error('ProductName cannot be empty');
    }
    if (trimmed.length > ProductName.MAX_LENGTH) {
      throw new Error(`ProductName cannot exceed ${ProductName.MAX_LENGTH} characters`);
    }
    return new ProductName(trimmed);
  }

  equals(other: ProductName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
