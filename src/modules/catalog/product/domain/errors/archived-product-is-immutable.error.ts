import { DomainError } from '../../../../../shared/domain/domain-error';

export type ArchivedProductImmutableOperation =
  | 'rename'
  | 'attach_category'
  | 'detach_category'
  | 'add_attribute'
  | 'update_attribute'
  | 'remove_attribute'
  | 'archive';

export class ArchivedProductIsImmutableError extends DomainError {
  readonly code = 'product.archived_is_immutable';

  constructor(public readonly operation: ArchivedProductImmutableOperation) {
    super(
      `Operation "${operation}" is not allowed on an archived product. Only the description can be changed.`,
    );
  }
}
