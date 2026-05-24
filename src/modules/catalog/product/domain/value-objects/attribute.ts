export class Attribute {
  static readonly KEY_MAX_LENGTH = 100;
  static readonly VALUE_MAX_LENGTH = 500;

  private constructor(
    public readonly key: string,
    public readonly value: string,
  ) {}

  static of(key: string, value: string): Attribute {
    if (typeof key !== 'string') {
      throw new Error('Attribute key must be a string');
    }
    if (typeof value !== 'string') {
      throw new Error('Attribute value must be a string');
    }
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    if (trimmedKey.length === 0) {
      throw new Error('Attribute key cannot be empty');
    }
    if (trimmedValue.length === 0) {
      throw new Error('Attribute value cannot be empty');
    }
    if (trimmedKey.length > Attribute.KEY_MAX_LENGTH) {
      throw new Error(`Attribute key cannot exceed ${Attribute.KEY_MAX_LENGTH} characters`);
    }
    if (trimmedValue.length > Attribute.VALUE_MAX_LENGTH) {
      throw new Error(`Attribute value cannot exceed ${Attribute.VALUE_MAX_LENGTH} characters`);
    }
    return new Attribute(trimmedKey, trimmedValue);
  }

  withValue(value: string): Attribute {
    return Attribute.of(this.key, value);
  }

  equals(other: Attribute): boolean {
    return this.key === other.key && this.value === other.value;
  }
}
