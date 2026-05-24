import { DomainError } from '../../../../../shared/domain/domain-error';

export class ParentCategoryNotFoundError extends DomainError {
  readonly code = 'category.parent_not_found';

  constructor(public readonly parentId: string) {
    super(`Parent category "${parentId}" does not exist`);
  }
}
