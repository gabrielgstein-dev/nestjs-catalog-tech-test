import { DomainError } from '../../../../../shared/domain/domain-error';

export class AttributeKeyNotFoundError extends DomainError {
  readonly code = 'product.attribute_key_not_found';

  constructor(public readonly key: string) {
    super(`Attribute key "${key}" was not found on this product`);
  }
}
