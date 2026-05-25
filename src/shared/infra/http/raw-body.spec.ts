import { wasFieldSent } from './raw-body';

describe('wasFieldSent', () => {
  it('returns true when the key was actually present in the JSON', () => {
    expect(wasFieldSent({ description: 'hello' }, 'description')).toBe(true);
  });

  it('distinguishes "present with null" from "absent" — both PATCH semantics need this', () => {
    expect(wasFieldSent({ parentId: null }, 'parentId')).toBe(true);
    expect(wasFieldSent({}, 'parentId')).toBe(false);
  });

  it('returns false for null, undefined or non-object bodies (defensive guard)', () => {
    expect(wasFieldSent(null, 'x')).toBe(false);
    expect(wasFieldSent(undefined, 'x')).toBe(false);
    expect(wasFieldSent('a string', 'x')).toBe(false);
    expect(wasFieldSent(42, 'x')).toBe(false);
  });

  it('does NOT walk the prototype chain (so inherited properties never count as "sent")', () => {
    const proto = { inherited: 1 };
    const obj = Object.create(proto);
    expect(wasFieldSent(obj, 'inherited')).toBe(false);
    obj.own = 1;
    expect(wasFieldSent(obj, 'own')).toBe(true);
  });
});
