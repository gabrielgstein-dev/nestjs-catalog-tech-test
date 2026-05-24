import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { CategoryId } from '../../category/domain/value-objects/category-id';
import { ProductId } from './value-objects/product-id';
import { ProductName } from './value-objects/product-name';
import { ProductDescription } from './value-objects/product-description';
import { ProductStatus } from './value-objects/product-status';
import { Attribute } from './value-objects/attribute';
import { AttributeCollection } from './value-objects/attribute-collection';
import { ProductCannotBeActivatedError } from './errors/product-cannot-be-activated.error';
import { ArchivedProductIsImmutableError } from './errors/archived-product-is-immutable.error';
import { ProductCreated } from './events/product-created.event';
import { ProductActivated } from './events/product-activated.event';
import { ProductArchived } from './events/product-archived.event';
import { CategoryAttachedToProduct } from './events/category-attached-to-product.event';
import { CategoryDetachedFromProduct } from './events/category-detached-from-product.event';
import { AttributeAdded } from './events/attribute-added.event';
import { AttributeUpdated } from './events/attribute-updated.event';
import { AttributeRemoved } from './events/attribute-removed.event';

export interface ProductCreateProps {
  id: ProductId;
  name: ProductName;
  description?: ProductDescription;
}

export interface ProductRehydrateProps {
  id: ProductId;
  name: ProductName;
  description: ProductDescription;
  status: ProductStatus;
  categoryIds: ReadonlyArray<CategoryId>;
  attributes: AttributeCollection;
}

export class Product extends AggregateRoot {
  private _name: ProductName;
  private _description: ProductDescription;
  private _status: ProductStatus;
  private readonly _categoryIds: Map<string, CategoryId>;
  private _attributes: AttributeCollection;

  private constructor(
    public readonly id: ProductId,
    name: ProductName,
    description: ProductDescription,
    status: ProductStatus,
    categoryIds: ReadonlyArray<CategoryId>,
    attributes: AttributeCollection,
  ) {
    super();
    this._name = name;
    this._description = description;
    this._status = status;
    this._categoryIds = new Map(categoryIds.map((c) => [c.value, c]));
    this._attributes = attributes;
  }

  static create(props: ProductCreateProps): Product {
    const description = props.description ?? ProductDescription.of(null);
    const product = new Product(
      props.id,
      props.name,
      description,
      ProductStatus.DRAFT,
      [],
      AttributeCollection.empty(),
    );
    product.recordEvent(new ProductCreated(props.id.value, props.name.value, ProductStatus.DRAFT));
    return product;
  }

  static rehydrate(props: ProductRehydrateProps): Product {
    return new Product(
      props.id,
      props.name,
      props.description,
      props.status,
      props.categoryIds,
      props.attributes,
    );
  }

  get name(): ProductName {
    return this._name;
  }

  get description(): ProductDescription {
    return this._description;
  }

  get status(): ProductStatus {
    return this._status;
  }

  get categoryIds(): CategoryId[] {
    return Array.from(this._categoryIds.values());
  }

  get attributes(): AttributeCollection {
    return this._attributes;
  }

  isDraft(): boolean {
    return this._status === ProductStatus.DRAFT;
  }

  isActive(): boolean {
    return this._status === ProductStatus.ACTIVE;
  }

  isArchived(): boolean {
    return this._status === ProductStatus.ARCHIVED;
  }

  rename(name: ProductName): void {
    if (this.isArchived()) {
      throw new ArchivedProductIsImmutableError('rename');
    }
    if (this._name.equals(name)) {
      return;
    }
    this._name = name;
  }

  changeDescription(description: ProductDescription): void {
    if (this._description.equals(description)) {
      return;
    }
    this._description = description;
  }

  attachCategory(categoryId: CategoryId): void {
    if (this.isArchived()) {
      throw new ArchivedProductIsImmutableError('attach_category');
    }
    if (this._categoryIds.has(categoryId.value)) {
      return;
    }
    this._categoryIds.set(categoryId.value, categoryId);
    this.recordEvent(new CategoryAttachedToProduct(this.id.value, categoryId.value));
  }

  detachCategory(categoryId: CategoryId): void {
    if (this.isArchived()) {
      throw new ArchivedProductIsImmutableError('detach_category');
    }
    if (!this._categoryIds.has(categoryId.value)) {
      return;
    }
    this._categoryIds.delete(categoryId.value);
    this.recordEvent(new CategoryDetachedFromProduct(this.id.value, categoryId.value));
  }

  addAttribute(attribute: Attribute): void {
    if (this.isArchived()) {
      throw new ArchivedProductIsImmutableError('add_attribute');
    }
    this._attributes = this._attributes.add(attribute);
    this.recordEvent(new AttributeAdded(this.id.value, attribute.key, attribute.value));
  }

  updateAttribute(attribute: Attribute): void {
    if (this.isArchived()) {
      throw new ArchivedProductIsImmutableError('update_attribute');
    }
    const current = this._attributes.get(attribute.key);
    if (current && current.equals(attribute)) {
      return;
    }
    this._attributes = this._attributes.update(attribute);
    this.recordEvent(new AttributeUpdated(this.id.value, attribute.key, attribute.value));
  }

  removeAttribute(key: string): void {
    if (this.isArchived()) {
      throw new ArchivedProductIsImmutableError('remove_attribute');
    }
    this._attributes = this._attributes.remove(key);
    this.recordEvent(new AttributeRemoved(this.id.value, key));
  }

  activate(): void {
    if (this.isActive()) {
      throw new ProductCannotBeActivatedError('already_active');
    }
    if (this.isArchived()) {
      throw new ProductCannotBeActivatedError('archived');
    }
    if (this._categoryIds.size === 0) {
      throw new ProductCannotBeActivatedError('missing_categories');
    }
    if (this._attributes.isEmpty()) {
      throw new ProductCannotBeActivatedError('missing_attributes');
    }
    this._status = ProductStatus.ACTIVE;
    this.recordEvent(new ProductActivated(this.id.value));
  }

  archive(): void {
    if (this.isArchived()) {
      throw new ArchivedProductIsImmutableError('archive');
    }
    this._status = ProductStatus.ARCHIVED;
    this.recordEvent(new ProductArchived(this.id.value));
  }
}
