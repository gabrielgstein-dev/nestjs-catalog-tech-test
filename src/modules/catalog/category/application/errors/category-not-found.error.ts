import { DomainError } from '../../../../../shared/domain/domain-error';

export class CategoryNotFoundError extends DomainError {
  readonly code = 'category.not_found';

  constructor(public readonly categoryId: string) {
    super(`Category "${categoryId}" was not found`);
  }
}
