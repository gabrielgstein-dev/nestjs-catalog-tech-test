import { Category } from './category';
import { CategoryId } from './value-objects/category-id';
import { CategoryName } from './value-objects/category-name';
import { CategoryCannotBeOwnParentError } from './errors/category-cannot-be-own-parent.error';
import { CategoryCreated } from './events/category-created.event';
import { CategoryUpdated } from './events/category-updated.event';

const id = (v: string) => CategoryId.of(v);
const name = (v: string) => CategoryName.of(v);

describe('Category', () => {
  describe('create', () => {
    it('creates with no parent and records CategoryCreated', () => {
      const cat = Category.create({ id: id('c1'), name: name('Eletrônicos') });

      expect(cat.id.value).toBe('c1');
      expect(cat.name.value).toBe('Eletrônicos');
      expect(cat.parentId).toBeNull();

      const events = cat.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CategoryCreated);
      const created = events[0] as CategoryCreated;
      expect(created.aggregateId).toBe('c1');
      expect(created.name).toBe('Eletrônicos');
      expect(created.parentId).toBeNull();
      expect(created.eventName).toBe(CategoryCreated.EVENT_NAME);
    });

    it('creates with a different parent', () => {
      const cat = Category.create({
        id: id('c2'),
        name: name('Notebooks'),
        parentId: id('c1'),
      });

      expect(cat.parentId?.value).toBe('c1');
      const created = cat.pullDomainEvents()[0] as CategoryCreated;
      expect(created.parentId).toBe('c1');
    });

    it('throws CategoryCannotBeOwnParentError when parentId equals own id', () => {
      expect(() => Category.create({ id: id('c1'), name: name('x'), parentId: id('c1') })).toThrow(
        CategoryCannotBeOwnParentError,
      );
    });
  });

  describe('rehydrate', () => {
    it('reconstructs without emitting events', () => {
      const cat = Category.rehydrate({
        id: id('c1'),
        name: name('x'),
        parentId: id('p1'),
      });

      expect(cat.pullDomainEvents()).toHaveLength(0);
      expect(cat.parentId?.value).toBe('p1');
    });
  });

  describe('rename', () => {
    it('updates the name and emits CategoryUpdated', () => {
      const cat = Category.rehydrate({
        id: id('c1'),
        name: name('Old'),
        parentId: null,
      });

      cat.rename(name('New'));

      expect(cat.name.value).toBe('New');
      const events = cat.pullDomainEvents();
      expect(events).toHaveLength(1);
      const updated = events[0] as CategoryUpdated;
      expect(updated).toBeInstanceOf(CategoryUpdated);
      expect(updated.changes).toEqual({ name: 'New' });
    });

    it('is a no-op when the new name equals the current one', () => {
      const cat = Category.rehydrate({
        id: id('c1'),
        name: name('Same'),
        parentId: null,
      });

      cat.rename(name('Same'));
      expect(cat.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('changeParent', () => {
    it('updates the parent and emits CategoryUpdated', () => {
      const cat = Category.rehydrate({
        id: id('c1'),
        name: name('x'),
        parentId: null,
      });

      cat.changeParent(id('p2'));

      expect(cat.parentId?.value).toBe('p2');
      const updated = cat.pullDomainEvents()[0] as CategoryUpdated;
      expect(updated.changes).toEqual({ parentId: 'p2' });
    });

    it('detaches the parent (null) and emits CategoryUpdated', () => {
      const cat = Category.rehydrate({
        id: id('c1'),
        name: name('x'),
        parentId: id('p1'),
      });

      cat.changeParent(null);

      expect(cat.parentId).toBeNull();
      const updated = cat.pullDomainEvents()[0] as CategoryUpdated;
      expect(updated.changes).toEqual({ parentId: null });
    });

    it('is a no-op when the parent does not actually change', () => {
      const cat = Category.rehydrate({
        id: id('c1'),
        name: name('x'),
        parentId: id('p1'),
      });

      cat.changeParent(id('p1'));
      expect(cat.pullDomainEvents()).toHaveLength(0);
    });

    it('throws CategoryCannotBeOwnParentError when setting itself as parent', () => {
      const cat = Category.rehydrate({
        id: id('c1'),
        name: name('x'),
        parentId: null,
      });

      expect(() => cat.changeParent(id('c1'))).toThrow(CategoryCannotBeOwnParentError);
    });
  });
});
