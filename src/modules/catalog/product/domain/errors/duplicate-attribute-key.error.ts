import { DomainError } from '../../../../../shared/domain/domain-error';

export class DuplicateAttributeKeyError extends DomainError {
  readonly code = 'product.duplicate_attribute_key';

  constructor(public readonly key: string) {
    super(`Attribute key "${key}" already exists on this product`);
  }
}
