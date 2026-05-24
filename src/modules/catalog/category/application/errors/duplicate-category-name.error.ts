import { DomainError } from '../../../../../shared/domain/domain-error';

export class DuplicateCategoryNameError extends DomainError {
  readonly code = 'category.duplicate_name';

  constructor(public readonly name: string) {
    super(`A category with name "${name}" already exists`);
  }
}
