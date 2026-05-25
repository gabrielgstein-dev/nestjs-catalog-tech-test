/**
 * Returns true iff the field key was actually present in the raw JSON body
 * the caller sent. Use for partial-PATCH semantics where we need to tell
 * "field absent (don't touch)" apart from "field present with null (clear it)".
 *
 * Don't use `Object.prototype.hasOwnProperty.call(dto, field)` for this:
 * with target ES2022 (or `useDefineForClassFields: true`), declared class
 * fields on the DTO are materialised as own properties of every instance
 * BEFORE class-transformer copies anything from the request — so a missing
 * field shows up as an own property whose value is undefined, defeating the
 * absent-vs-null distinction.
 */
export const wasFieldSent = (rawBody: unknown, field: string): boolean => {
  if (rawBody === null || typeof rawBody !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(rawBody, field);
};
