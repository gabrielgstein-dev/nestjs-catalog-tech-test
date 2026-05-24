import { DomainError } from '../../../../../shared/domain/domain-error';

export class ProductNotFoundError extends DomainError {
  readonly code = 'product.not_found';

  constructor(public readonly productId: string) {
    super(`Product "${productId}" was not found`);
  }
}
