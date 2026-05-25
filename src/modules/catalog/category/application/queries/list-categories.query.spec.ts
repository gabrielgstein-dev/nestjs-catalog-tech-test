import { ListCategoriesQuery } from './list-categories.query';

describe('ListCategoriesQuery', () => {
  it('defaults limit=50 and offset=0 when nothing is passed (controller fallback path)', () => {
    const q = new ListCategoriesQuery();
    expect(q.limit).toBe(50);
    expect(q.offset).toBe(0);
  });

  it('honours explicit values', () => {
    const q = new ListCategoriesQuery(25, 10);
    expect(q.limit).toBe(25);
    expect(q.offset).toBe(10);
  });
});
