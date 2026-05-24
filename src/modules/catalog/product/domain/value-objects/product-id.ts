export class ProductId {
  private constructor(public readonly value: string) {}

  static of(value: string): ProductId {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new Error('ProductId cannot be empty');
    }
    return new ProductId(trimmed);
  }

  equals(other: ProductId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
