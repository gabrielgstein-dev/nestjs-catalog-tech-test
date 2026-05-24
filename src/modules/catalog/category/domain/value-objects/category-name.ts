export class CategoryName {
  static readonly MAX_LENGTH = 120;

  private constructor(public readonly value: string) {}

  static of(value: string): CategoryName {
    if (typeof value !== 'string') {
      throw new Error('CategoryName must be a string');
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error('CategoryName cannot be empty');
    }
    if (trimmed.length > CategoryName.MAX_LENGTH) {
      throw new Error(`CategoryName cannot exceed ${CategoryName.MAX_LENGTH} characters`);
    }
    return new CategoryName(trimmed);
  }

  equals(other: CategoryName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
