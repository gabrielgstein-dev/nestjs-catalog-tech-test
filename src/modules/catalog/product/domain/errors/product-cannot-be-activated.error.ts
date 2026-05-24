import { DomainError } from '../../../../../shared/domain/domain-error';

export type ProductCannotBeActivatedReason =
  | 'missing_categories'
  | 'missing_attributes'
  | 'already_active'
  | 'archived';

const messageFor = (reason: ProductCannotBeActivatedReason): string => {
  switch (reason) {
    case 'missing_categories':
      return 'Product cannot be activated: at least one category is required';
    case 'missing_attributes':
      return 'Product cannot be activated: at least one attribute is required';
    case 'already_active':
      return 'Product cannot be activated: it is already active';
    case 'archived':
      return 'Product cannot be activated: it is archived (terminal state)';
  }
};

export class ProductCannotBeActivatedError extends DomainError {
  readonly code = 'product.cannot_be_activated';

  constructor(public readonly reason: ProductCannotBeActivatedReason) {
    super(messageFor(reason));
  }
}
