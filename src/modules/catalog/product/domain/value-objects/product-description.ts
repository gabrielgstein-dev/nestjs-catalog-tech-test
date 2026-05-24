export class ProductDescription {
  static readonly MAX_LENGTH = 2000;

  private constructor(public readonly value: string | null) {}

  static of(value: string | null | undefined): ProductDescription {
    if (value === null || value === undefined) {
      return new ProductDescription(null);
    }
    if (typeof value !== 'string') {
      throw new Error('ProductDescription must be a string when provided');
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return new ProductDescription(null);
    }
    if (trimmed.length > ProductDescription.MAX_LENGTH) {
      throw new Error(
        `ProductDescription cannot exceed ${ProductDescription.MAX_LENGTH} characters`,
      );
    }
    return new ProductDescription(trimmed);
  }

  isEmpty(): boolean {
    return this.value === null;
  }

  equals(other: ProductDescription): boolean {
    return this.value === other.value;
  }
}
