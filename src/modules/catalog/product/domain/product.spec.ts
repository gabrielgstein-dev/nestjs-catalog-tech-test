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
import { DuplicateAttributeKeyError } from './errors/duplicate-attribute-key.error';
import { AttributeKeyNotFoundError } from './errors/attribute-key-not-found.error';
import { ProductCreated } from './events/product-created.event';
import { ProductActivated } from './events/product-activated.event';
import { ProductArchived } from './events/product-archived.event';
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
    it('updates the description', () => {
      const p = buildDraft();
      p.changeDescription(pdesc('new'));
      expect(p.description.value).toBe('new');
    });

    it('is allowed on ARCHIVED products', () => {
      const p = buildArchived();
      expect(() => p.changeDescription(pdesc('still mutable'))).not.toThrow();
      expect(p.description.value).toBe('still mutable');
    });

    it('is a no-op when value does not change', () => {
      const p = buildDraft();
      p.changeDescription(pdesc('x'));
      p.pullDomainEvents();

      p.changeDescription(pdesc('x'));
      expect(p.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('rename', () => {
    it('renames a DRAFT product', () => {
      const p = buildDraft();
      p.rename(pname('Novo nome'));
      expect(p.name.value).toBe('Novo nome');
    });

    it('renames an ACTIVE product', () => {
      const p = buildActive();
      p.rename(pname('Novo nome'));
      expect(p.name.value).toBe('Novo nome');
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
});
