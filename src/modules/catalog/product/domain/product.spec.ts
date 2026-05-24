import { Product } from './product';
import { ProductId } from './value-objects/product-id';
import { ProductName } from './value-objects/product-name';
import { ProductDescription } from './value-objects/product-description';
import { ProductStatus } from './value-objects/product-status';
import { Attribute } from './value-objects/attribute';
import { AttributeCollection } from './value-objects/attribute-collection';
import { CategoryId } from '../../category/domain/value-objects/category-id';
import { ProductCannotBeActivatedError } from './errors/product-cannot-be-activated.error';
import { ArchivedProductIsImmutableError } from './errors/archived-product-is-immutable.error';
import { ActiveProductInvariantViolatedError } from './errors/active-product-invariant-violated.error';
import { InvalidProductStateError } from './errors/invalid-product-state.error';
import { DuplicateAttributeKeyError } from './errors/duplicate-attribute-key.error';
import { AttributeKeyNotFoundError } from './errors/attribute-key-not-found.error';
import { ProductCreated } from './events/product-created.event';
import { ProductActivated } from './events/product-activated.event';
import { ProductArchived } from './events/product-archived.event';
import { ProductRenamed } from './events/product-renamed.event';
import { ProductDescriptionChanged } from './events/product-description-changed.event';
import { CategoryAttachedToProduct } from './events/category-attached-to-product.event';
import { CategoryDetachedFromProduct } from './events/category-detached-from-product.event';
import { AttributeAdded } from './events/attribute-added.event';
import { AttributeUpdated } from './events/attribute-updated.event';
import { AttributeRemoved } from './events/attribute-removed.event';

const pid = (v = 'p1') => ProductId.of(v);
const pname = (v = 'Cadeira') => ProductName.of(v);
const pdesc = (v?: string | null) => ProductDescription.of(v);
const cid = (v: string) => CategoryId.of(v);
const attr = (k: string, v: string) => Attribute.of(k, v);

const buildDraft = () => Product.create({ id: pid(), name: pname() });

const buildDraftWithCatAndAttr = () => {
  const p = buildDraft();
  p.attachCategory(cid('c1'));
  p.addAttribute(attr('cor', 'azul'));
  p.pullDomainEvents();
  return p;
};

const buildActive = () => {
  const p = buildDraftWithCatAndAttr();
  p.activate();
  p.pullDomainEvents();
  return p;
};

const buildArchived = () => {
  const p = buildDraftWithCatAndAttr();
  p.archive();
  p.pullDomainEvents();
  return p;
};

describe('Product', () => {
  describe('create', () => {
    it('starts in DRAFT with no categories and no attributes', () => {
      const p = Product.create({ id: pid('p1'), name: pname('Cadeira') });

      expect(p.id.value).toBe('p1');
      expect(p.name.value).toBe('Cadeira');
      expect(p.description.value).toBeNull();
      expect(p.status).toBe(ProductStatus.DRAFT);
      expect(p.isDraft()).toBe(true);
      expect(p.categoryIds).toEqual([]);
      expect(p.attributes.isEmpty()).toBe(true);
    });

    it('records ProductCreated', () => {
      const p = Product.create({ id: pid('p1'), name: pname('Cadeira') });
      const events = p.pullDomainEvents();

      expect(events).toHaveLength(1);
      const e = events[0] as ProductCreated;
      expect(e).toBeInstanceOf(ProductCreated);
      expect(e.aggregateId).toBe('p1');
      expect(e.name).toBe('Cadeira');
      expect(e.status).toBe(ProductStatus.DRAFT);
      expect(e.eventName).toBe(ProductCreated.EVENT_NAME);
    });

    it('accepts an initial description', () => {
      const p = Product.create({
        id: pid(),
        name: pname(),
        description: pdesc('Premium chair'),
      });
      expect(p.description.value).toBe('Premium chair');
    });
  });

  describe('rehydrate', () => {
    it('reconstructs without emitting events', () => {
      const p = Product.rehydrate({
        id: pid('p1'),
        name: pname('Mesa'),
        description: pdesc('madeira'),
        status: ProductStatus.ACTIVE,
        categoryIds: [cid('c1')],
        attributes: AttributeCollection.of([attr('cor', 'azul')]),
      });

      expect(p.status).toBe(ProductStatus.ACTIVE);
      expect(p.categoryIds).toHaveLength(1);
      expect(p.attributes.size).toBe(1);
      expect(p.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('attachCategory / detachCategory', () => {
    it('attaches and emits CategoryAttachedToProduct', () => {
      const p = buildDraft();
      p.pullDomainEvents();

      p.attachCategory(cid('c1'));

      expect(p.categoryIds.map((c) => c.value)).toEqual(['c1']);
      const events = p.pullDomainEvents();
      expect(events).toHaveLength(1);
      const e = events[0] as CategoryAttachedToProduct;
      expect(e).toBeInstanceOf(CategoryAttachedToProduct);
      expect(e.aggregateId).toBe('p1');
      expect(e.categoryId).toBe('c1');
    });

    it('attaching the same category twice is a no-op', () => {
      const p = buildDraft();
      p.attachCategory(cid('c1'));
      p.pullDomainEvents();

      p.attachCategory(cid('c1'));

      expect(p.categoryIds).toHaveLength(1);
      expect(p.pullDomainEvents()).toHaveLength(0);
    });

    it('detaches and emits CategoryDetachedFromProduct', () => {
      const p = buildDraft();
      p.attachCategory(cid('c1'));
      p.pullDomainEvents();

      p.detachCategory(cid('c1'));

      expect(p.categoryIds).toHaveLength(0);
      const events = p.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CategoryDetachedFromProduct);
    });

    it('detaching an unattached category is a no-op', () => {
      const p = buildDraft();
      p.pullDomainEvents();

      p.detachCategory(cid('c1'));

      expect(p.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('attributes (add / update / remove)', () => {
    it('adds and emits AttributeAdded', () => {
      const p = buildDraft();
      p.pullDomainEvents();

      p.addAttribute(attr('cor', 'azul'));

      expect(p.attributes.get('cor')?.value).toBe('azul');
      const e = p.pullDomainEvents()[0] as AttributeAdded;
      expect(e).toBeInstanceOf(AttributeAdded);
      expect(e.key).toBe('cor');
      expect(e.value).toBe('azul');
    });

    it('rejects duplicate keys with DuplicateAttributeKeyError', () => {
      const p = buildDraft();
      p.addAttribute(attr('cor', 'azul'));

      expect(() => p.addAttribute(attr('cor', 'verde'))).toThrow(DuplicateAttributeKeyError);
    });

    it('updates and emits AttributeUpdated', () => {
      const p = buildDraft();
      p.addAttribute(attr('cor', 'azul'));
      p.pullDomainEvents();

      p.updateAttribute(attr('cor', 'verde'));

      expect(p.attributes.get('cor')?.value).toBe('verde');
      const e = p.pullDomainEvents()[0] as AttributeUpdated;
      expect(e).toBeInstanceOf(AttributeUpdated);
      expect(e.value).toBe('verde');
    });

    it('updating to the same value is a no-op', () => {
      const p = buildDraft();
      p.addAttribute(attr('cor', 'azul'));
      p.pullDomainEvents();

      p.updateAttribute(attr('cor', 'azul'));

      expect(p.pullDomainEvents()).toHaveLength(0);
    });

    it('updating a missing key throws AttributeKeyNotFoundError', () => {
      const p = buildDraft();
      expect(() => p.updateAttribute(attr('cor', 'azul'))).toThrow(AttributeKeyNotFoundError);
    });

    it('removes and emits AttributeRemoved', () => {
      const p = buildDraft();
      p.addAttribute(attr('cor', 'azul'));
      p.pullDomainEvents();

      p.removeAttribute('cor');

      expect(p.attributes.has('cor')).toBe(false);
      const e = p.pullDomainEvents()[0] as AttributeRemoved;
      expect(e).toBeInstanceOf(AttributeRemoved);
      expect(e.key).toBe('cor');
    });

    it('removing a missing key throws AttributeKeyNotFoundError', () => {
      const p = buildDraft();
      expect(() => p.removeAttribute('cor')).toThrow(AttributeKeyNotFoundError);
    });
  });

  describe('changeDescription', () => {
    it('updates the description and emits ProductDescriptionChanged', () => {
      const p = buildDraft();
      p.pullDomainEvents();

      p.changeDescription(pdesc('new'));

      expect(p.description.value).toBe('new');
      const e = p.pullDomainEvents()[0] as ProductDescriptionChanged;
      expect(e).toBeInstanceOf(ProductDescriptionChanged);
      expect(e.aggregateId).toBe('p1');
      expect(e.description).toBe('new');
      expect(e.eventName).toBe(ProductDescriptionChanged.EVENT_NAME);
    });

    it('emits null on the event when description is cleared', () => {
      const p = buildDraft();
      p.changeDescription(pdesc('first'));
      p.pullDomainEvents();

      p.changeDescription(pdesc(null));

      const e = p.pullDomainEvents()[0] as ProductDescriptionChanged;
      expect(e.description).toBeNull();
    });

    it('is allowed on ARCHIVED products', () => {
      const p = buildArchived();
      expect(() => p.changeDescription(pdesc('still mutable'))).not.toThrow();
      expect(p.description.value).toBe('still mutable');
    });

    it('is a no-op when value does not change (no event emitted)', () => {
      const p = buildDraft();
      p.changeDescription(pdesc('x'));
      p.pullDomainEvents();

      p.changeDescription(pdesc('x'));
      expect(p.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('rename', () => {
    it('renames a DRAFT product and emits ProductRenamed', () => {
      const p = buildDraft();
      p.pullDomainEvents();

      p.rename(pname('Novo nome'));

      expect(p.name.value).toBe('Novo nome');
      const e = p.pullDomainEvents()[0] as ProductRenamed;
      expect(e).toBeInstanceOf(ProductRenamed);
      expect(e.aggregateId).toBe('p1');
      expect(e.name).toBe('Novo nome');
      expect(e.eventName).toBe(ProductRenamed.EVENT_NAME);
    });

    it('renames an ACTIVE product and emits ProductRenamed', () => {
      const p = buildActive();
      p.rename(pname('Novo nome'));
      expect(p.name.value).toBe('Novo nome');
      expect(p.pullDomainEvents()[0]).toBeInstanceOf(ProductRenamed);
    });

    it('is a no-op when renamed to the same value (no event emitted)', () => {
      const p = buildDraft();
      p.pullDomainEvents();
      p.rename(pname('Cadeira'));
      expect(p.pullDomainEvents()).toHaveLength(0);
    });

    it('rejects rename on ARCHIVED with ArchivedProductIsImmutableError', () => {
      const p = buildArchived();
      expect(() => p.rename(pname('Outro'))).toThrow(ArchivedProductIsImmutableError);
    });
  });

  describe('activate', () => {
    it('activates a DRAFT with ≥1 category and ≥1 attribute', () => {
      const p = buildDraftWithCatAndAttr();
      p.activate();
      expect(p.status).toBe(ProductStatus.ACTIVE);
      const events = p.pullDomainEvents();
      const activated = events.find((e) => e instanceof ProductActivated) as ProductActivated;
      expect(activated).toBeDefined();
      expect(activated.aggregateId).toBe('p1');
    });

    it('throws missing_categories when there are no categories', () => {
      const p = buildDraft();
      p.addAttribute(attr('cor', 'azul'));

      try {
        p.activate();
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProductCannotBeActivatedError);
        expect((err as ProductCannotBeActivatedError).reason).toBe('missing_categories');
      }
    });

    it('throws missing_attributes when there are no attributes', () => {
      const p = buildDraft();
      p.attachCategory(cid('c1'));

      try {
        p.activate();
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProductCannotBeActivatedError);
        expect((err as ProductCannotBeActivatedError).reason).toBe('missing_attributes');
      }
    });

    it('throws already_active when status is ACTIVE', () => {
      const p = buildActive();
      try {
        p.activate();
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProductCannotBeActivatedError);
        expect((err as ProductCannotBeActivatedError).reason).toBe('already_active');
      }
    });

    it('throws archived when status is ARCHIVED (terminal)', () => {
      const p = buildArchived();
      try {
        p.activate();
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProductCannotBeActivatedError);
        expect((err as ProductCannotBeActivatedError).reason).toBe('archived');
      }
    });
  });

  describe('archive', () => {
    it('archives a DRAFT', () => {
      const p = buildDraft();
      p.archive();
      expect(p.status).toBe(ProductStatus.ARCHIVED);
      const e = p.pullDomainEvents().find((x) => x instanceof ProductArchived) as ProductArchived;
      expect(e).toBeDefined();
    });

    it('archives an ACTIVE product', () => {
      const p = buildActive();
      p.archive();
      expect(p.status).toBe(ProductStatus.ARCHIVED);
    });

    it('archiving an already-ARCHIVED product throws ArchivedProductIsImmutableError', () => {
      const p = buildArchived();
      expect(() => p.archive()).toThrow(ArchivedProductIsImmutableError);
    });
  });

  describe('ARCHIVED immutability', () => {
    it('rejects attachCategory', () => {
      const p = buildArchived();
      expect(() => p.attachCategory(cid('c2'))).toThrow(ArchivedProductIsImmutableError);
    });

    it('rejects detachCategory', () => {
      const p = buildArchived();
      expect(() => p.detachCategory(cid('c1'))).toThrow(ArchivedProductIsImmutableError);
    });

    it('rejects addAttribute', () => {
      const p = buildArchived();
      expect(() => p.addAttribute(attr('material', 'metal'))).toThrow(
        ArchivedProductIsImmutableError,
      );
    });

    it('rejects updateAttribute', () => {
      const p = buildArchived();
      expect(() => p.updateAttribute(attr('cor', 'verde'))).toThrow(
        ArchivedProductIsImmutableError,
      );
    });

    it('rejects removeAttribute', () => {
      const p = buildArchived();
      expect(() => p.removeAttribute('cor')).toThrow(ArchivedProductIsImmutableError);
    });

    it('rejects rename', () => {
      const p = buildArchived();
      expect(() => p.rename(pname('Outro'))).toThrow(ArchivedProductIsImmutableError);
    });

    it('still allows changeDescription', () => {
      const p = buildArchived();
      expect(() => p.changeDescription(pdesc('changed'))).not.toThrow();
    });

    it('reports the operation on the error', () => {
      const p = buildArchived();
      try {
        p.attachCategory(cid('c2'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ArchivedProductIsImmutableError);
        expect((err as ArchivedProductIsImmutableError).operation).toBe('attach_category');
      }
    });
  });

  describe('ACTIVE invariant continuity', () => {
    it('blocks removing the last category from an ACTIVE product', () => {
      const p = buildActive();
      try {
        p.detachCategory(cid('c1'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ActiveProductInvariantViolatedError);
        expect((err as ActiveProductInvariantViolatedError).reason).toBe('last_category_removed');
      }
    });

    it('blocks removing the last attribute from an ACTIVE product', () => {
      const p = buildActive();
      try {
        p.removeAttribute('cor');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ActiveProductInvariantViolatedError);
        expect((err as ActiveProductInvariantViolatedError).reason).toBe('last_attribute_removed');
      }
    });

    it('allows removing a category when others remain on ACTIVE', () => {
      const p = buildActive();
      p.attachCategory(cid('c2'));
      p.pullDomainEvents();

      expect(() => p.detachCategory(cid('c1'))).not.toThrow();
      expect(p.categoryIds.map((c) => c.value)).toEqual(['c2']);
    });

    it('allows removing an attribute when others remain on ACTIVE', () => {
      const p = buildActive();
      p.addAttribute(attr('material', 'metal'));
      p.pullDomainEvents();

      expect(() => p.removeAttribute('cor')).not.toThrow();
      expect(p.attributes.has('cor')).toBe(false);
    });

    it('does NOT enforce this rule on DRAFT — emptying is allowed', () => {
      const p = buildDraft();
      p.attachCategory(cid('c1'));
      p.addAttribute(attr('cor', 'azul'));
      p.pullDomainEvents();

      expect(() => p.detachCategory(cid('c1'))).not.toThrow();
      expect(() => p.removeAttribute('cor')).not.toThrow();
    });

    it('detaching a non-attached category on ACTIVE is still a no-op (does not trip the rule)', () => {
      const p = buildActive();
      p.pullDomainEvents();
      expect(() => p.detachCategory(cid('does-not-exist'))).not.toThrow();
      expect(p.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('rehydrate validations', () => {
    it('rejects duplicate category ids', () => {
      try {
        Product.rehydrate({
          id: pid('p1'),
          name: pname(),
          description: pdesc(null),
          status: ProductStatus.DRAFT,
          categoryIds: [cid('c1'), cid('c1')],
          attributes: AttributeCollection.empty(),
        });
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidProductStateError);
        expect((err as InvalidProductStateError).reason).toBe('duplicate_category_ids');
      }
    });

    it('rejects ACTIVE without categories', () => {
      try {
        Product.rehydrate({
          id: pid('p1'),
          name: pname(),
          description: pdesc(null),
          status: ProductStatus.ACTIVE,
          categoryIds: [],
          attributes: AttributeCollection.of([attr('cor', 'azul')]),
        });
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidProductStateError);
        expect((err as InvalidProductStateError).reason).toBe('active_without_categories');
      }
    });

    it('rejects ACTIVE without attributes', () => {
      try {
        Product.rehydrate({
          id: pid('p1'),
          name: pname(),
          description: pdesc(null),
          status: ProductStatus.ACTIVE,
          categoryIds: [cid('c1')],
          attributes: AttributeCollection.empty(),
        });
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidProductStateError);
        expect((err as InvalidProductStateError).reason).toBe('active_without_attributes');
      }
    });

    it('allows DRAFT with empty categories and attributes', () => {
      expect(() =>
        Product.rehydrate({
          id: pid('p1'),
          name: pname(),
          description: pdesc(null),
          status: ProductStatus.DRAFT,
          categoryIds: [],
          attributes: AttributeCollection.empty(),
        }),
      ).not.toThrow();
    });

    it('allows ARCHIVED with empty categories and attributes (terminal: any state preserved)', () => {
      expect(() =>
        Product.rehydrate({
          id: pid('p1'),
          name: pname(),
          description: pdesc(null),
          status: ProductStatus.ARCHIVED,
          categoryIds: [],
          attributes: AttributeCollection.empty(),
        }),
      ).not.toThrow();
    });
  });
});
