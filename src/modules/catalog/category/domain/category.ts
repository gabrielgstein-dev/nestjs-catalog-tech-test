import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { CategoryId } from './value-objects/category-id';
import { CategoryName } from './value-objects/category-name';
import { CategoryCannotBeOwnParentError } from './errors/category-cannot-be-own-parent.error';
import { CategoryCreated } from './events/category-created.event';
import { CategoryUpdated } from './events/category-updated.event';

export interface CategoryCreateProps {
  id: CategoryId;
  name: CategoryName;
  parentId?: CategoryId | null;
}

export interface CategoryRehydrateProps {
  id: CategoryId;
  name: CategoryName;
  parentId: CategoryId | null;
}

export class Category extends AggregateRoot {
  private _name: CategoryName;
  private _parentId: CategoryId | null;

  private constructor(
    public readonly id: CategoryId,
    name: CategoryName,
    parentId: CategoryId | null,
  ) {
    super();
    this._name = name;
    this._parentId = parentId;
  }

  static create(props: CategoryCreateProps): Category {
    const parentId = props.parentId ?? null;
    if (parentId && parentId.equals(props.id)) {
      throw new CategoryCannotBeOwnParentError(props.id.value);
    }
    const category = new Category(props.id, props.name, parentId);
    category.recordEvent(
      new CategoryCreated(props.id.value, props.name.value, parentId?.value ?? null),
    );
    return category;
  }

  static rehydrate(props: CategoryRehydrateProps): Category {
    if (props.parentId && props.parentId.equals(props.id)) {
      throw new CategoryCannotBeOwnParentError(props.id.value);
    }
    return new Category(props.id, props.name, props.parentId);
  }

  get name(): CategoryName {
    return this._name;
  }

  get parentId(): CategoryId | null {
    return this._parentId;
  }

  rename(name: CategoryName): void {
    if (this._name.equals(name)) {
      return;
    }
    this._name = name;
    this.recordEvent(new CategoryUpdated(this.id.value, { name: name.value }));
  }

  changeParent(parentId: CategoryId | null): void {
    if (parentId && parentId.equals(this.id)) {
      throw new CategoryCannotBeOwnParentError(this.id.value);
    }
    const current = this._parentId?.value ?? null;
    const next = parentId?.value ?? null;
    if (current === next) {
      return;
    }
    this._parentId = parentId;
    this.recordEvent(new CategoryUpdated(this.id.value, { parentId: next }));
  }
}
