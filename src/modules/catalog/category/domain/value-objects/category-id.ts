export class CategoryId {
  private constructor(public readonly value: string) {}

  static of(value: string): CategoryId {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new Error('CategoryId cannot be empty');
    }
    return new CategoryId(trimmed);
  }

  equals(other: CategoryId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
