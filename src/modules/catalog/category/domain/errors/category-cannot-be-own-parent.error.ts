import { DomainError } from '../../../../../shared/domain/domain-error';

export class CategoryCannotBeOwnParentError extends DomainError {
  readonly code = 'category.cannot_be_own_parent';

  constructor(public readonly categoryId: string) {
    super(`Category "${categoryId}" cannot be its own parent`);
  }
}
