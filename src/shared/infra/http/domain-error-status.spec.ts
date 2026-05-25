import { HttpStatus } from '@nestjs/common';
import { domainErrorToHttpStatus } from './domain-error-status';

describe('domainErrorToHttpStatus', () => {
  it.each([
    ['product.not_found', HttpStatus.NOT_FOUND],
    ['category.not_found', HttpStatus.NOT_FOUND],
    ['category.parent_not_found', HttpStatus.NOT_FOUND],
    ['product.attribute_key_not_found', HttpStatus.NOT_FOUND],
  ])('maps %s -> %s', (code, expected) => {
    expect(domainErrorToHttpStatus(code)).toBe(expected);
  });

  it.each([
    ['category.duplicate_name'],
    ['category.cannot_be_own_parent'],
    ['product.duplicate_attribute_key'],
    ['product.cannot_be_activated'],
    ['product.archived_is_immutable'],
    ['product.active_invariant_violated'],
    ['product.invalid_state'],
    ['something.brand_new_error'],
  ])('maps %s -> 409 Conflict', (code) => {
    expect(domainErrorToHttpStatus(code)).toBe(HttpStatus.CONFLICT);
  });
});
