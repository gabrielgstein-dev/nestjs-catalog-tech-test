import { DomainError } from '../../../../../shared/domain/domain-error';

export type InvalidProductStateReason =
  | 'duplicate_category_ids'
  | 'active_without_categories'
  | 'active_without_attributes';

const messageFor = (reason: InvalidProductStateReason): string => {
  switch (reason) {
    case 'duplicate_category_ids':
      return 'Product cannot be rehydrated with duplicate category ids.';
    case 'active_without_categories':
      return 'Product cannot be rehydrated as ACTIVE without at least one category.';
    case 'active_without_attributes':
      return 'Product cannot be rehydrated as ACTIVE without at least one attribute.';
  }
};

export class InvalidProductStateError extends DomainError {
  readonly code = 'product.invalid_state';

  constructor(public readonly reason: InvalidProductStateReason) {
    super(messageFor(reason));
  }
}
