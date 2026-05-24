import { Product } from '../../domain/product';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductName } from '../../domain/value-objects/product-name';
import { ProductDescription } from '../../domain/value-objects/product-description';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { Attribute } from '../../domain/value-objects/attribute';
import { AttributeCollection } from '../../domain/value-objects/attribute-collection';
import { CategoryId } from '../../../category/domain/value-objects/category-id';

interface Options {
  id?: string;
  name?: string;
  description?: string | null;
  status?: ProductStatus;
  categoryIds?: string[];
  attributes?: Array<[string, string]>;
}

export const buildProduct = (opts: Options = {}): Product => {
  return Product.rehydrate({
    id: ProductId.of(opts.id ?? 'p1'),
    name: ProductName.of(opts.name ?? 'Cadeira'),
    description: ProductDescription.of(opts.description ?? null),
    status: opts.status ?? ProductStatus.DRAFT,
    categoryIds: (opts.categoryIds ?? []).map((c) => CategoryId.of(c)),
    attributes: AttributeCollection.of((opts.attributes ?? []).map(([k, v]) => Attribute.of(k, v))),
  });
};
