import { DomainError } from '../../../../../shared/domain/domain-error';

export type ActiveProductInvariantViolation = 'last_category_removed' | 'last_attribute_removed';

const messageFor = (reason: ActiveProductInvariantViolation): string => {
  switch (reason) {
    case 'last_category_removed':
      return 'Active product must keep at least one category. Archive the product first to remove the last category.';
    case 'last_attribute_removed':
      return 'Active product must keep at least one attribute. Archive the product first to remove the last attribute.';
  }
};

export class ActiveProductInvariantViolatedError extends DomainError {
  readonly code = 'product.active_invariant_violated';

  constructor(public readonly reason: ActiveProductInvariantViolation) {
    super(messageFor(reason));
  }
}
