import { randomUUID } from 'node:crypto';
import { Category } from '../src/modules/catalog/category/domain/category';
import { CategoryId } from '../src/modules/catalog/category/domain/value-objects/category-id';
import { CategoryName } from '../src/modules/catalog/category/domain/value-objects/category-name';
import { CategoryRepositoryTypeOrm } from '../src/modules/catalog/category/infra/repositories/category.repository.typeorm';
import { ProductId } from '../src/modules/catalog/product/domain/value-objects/product-id';
import { ProductName } from '../src/modules/catalog/product/domain/value-objects/product-name';
import { ProductStatus } from '../src/modules/catalog/product/domain/value-objects/product-status';
import { Attribute } from '../src/modules/catalog/product/domain/value-objects/attribute';
import { ProductRepositoryTypeOrm } from '../src/modules/catalog/product/infra/repositories/product.repository.typeorm';
import { CatalogTestBed, startCatalogTestBed, truncateCatalog } from './helpers/catalog-test-bed';
import { buildProduct, newCategory, seedCategory } from './helpers/catalog-builders';

jest.setTimeout(180_000);

describe('Catalog persistence (integration)', () => {
  let bed: CatalogTestBed;
  let categoryRepo: CategoryRepositoryTypeOrm;
  let productRepo: ProductRepositoryTypeOrm;

  beforeAll(async () => {
    bed = await startCatalogTestBed();
    categoryRepo = new CategoryRepositoryTypeOrm(bed.dataSource);
    productRepo = new ProductRepositoryTypeOrm(bed.dataSource);
  });

  afterEach(async () => {
    await truncateCatalog(bed.dataSource);
  });

  afterAll(async () => {
    await bed?.stop();
  });

  describe('CategoryRepositoryTypeOrm', () => {
    it('persists and rehydrates a root category', async () => {
      const cat = newCategory('Eletrônicos');
      await categoryRepo.save(cat);
      const loaded = await categoryRepo.findById(cat.id);
      expect(loaded?.id.value).toBe(cat.id.value);
      expect(loaded?.name.value).toBe('Eletrônicos');
      expect(loaded?.parentId).toBeNull();
    });

    it('persists a category with a parent reference', async () => {
      const parent = newCategory('Eletrônicos');
      await categoryRepo.save(parent);

      const child = newCategory('Smartphones', parent.id);
      await categoryRepo.save(child);

      const loaded = await categoryRepo.findById(child.id);
      expect(loaded?.parentId?.value).toBe(parent.id.value);
    });

    it('updates an existing category on save (upsert)', async () => {
      const cat = newCategory('Foo');
      await categoryRepo.save(cat);

      cat.rename(CategoryName.of('Bar'));
      await categoryRepo.save(cat);

      const loaded = await categoryRepo.findById(cat.id);
      expect(loaded?.name.value).toBe('Bar');

      const rows: Array<{ count: string }> = await bed.dataSource.query(
        `SELECT count(*)::text AS count FROM category WHERE id = $1`,
        [cat.id.value],
      );
      expect(rows[0].count).toBe('1');
    });

    it('returns null when category id is missing', async () => {
      const loaded = await categoryRepo.findById(CategoryId.of(randomUUID()));
      expect(loaded).toBeNull();
    });

    it('existsById reflects presence', async () => {
      const id = CategoryId.of(randomUUID());
      expect(await categoryRepo.existsById(id)).toBe(false);

      await categoryRepo.save(Category.create({ id, name: CategoryName.of('X') }));
      expect(await categoryRepo.existsById(id)).toBe(true);
    });

    it('existsByName respects exceptId', async () => {
      const a = newCategory('SameName');
      const b = newCategory('Different');
      await categoryRepo.save(a);
      await categoryRepo.save(b);

      expect(await categoryRepo.existsByName(CategoryName.of('SameName'))).toBe(true);
      expect(await categoryRepo.existsByName(CategoryName.of('SameName'), a.id)).toBe(false);
      expect(await categoryRepo.existsByName(CategoryName.of('SameName'), b.id)).toBe(true);
    });

    it('rejects two categories with the same name at the DB level', async () => {
      await categoryRepo.save(newCategory('Unique'));
      await expect(categoryRepo.save(newCategory('Unique'))).rejects.toThrow(
        /duplicate key|unique/i,
      );
    });
  });

  describe('ProductRepositoryTypeOrm', () => {
    it('persists a DRAFT product and reads it back as the same aggregate', async () => {
      const product = buildProduct({
        name: 'Phone',
        description: 'A nice phone',
      });
      await productRepo.save(product);

      const loaded = await productRepo.findById(product.id);
      expect(loaded?.name.value).toBe('Phone');
      expect(loaded?.description.value).toBe('A nice phone');
      expect(loaded?.status).toBe(ProductStatus.DRAFT);
      expect(loaded?.categoryIds).toEqual([]);
      expect(loaded?.attributes.isEmpty()).toBe(true);
    });

    it('persists the aggregate transactionally with attributes and categories', async () => {
      const catA = await seedCategory(bed.dataSource, 'CatA');
      const catB = await seedCategory(bed.dataSource, 'CatB');

      const product = buildProduct({
        name: 'Phone',
        categoryIds: [catA, catB],
        attributes: [Attribute.of('color', 'black'), Attribute.of('size', '6.1')],
      });
      await productRepo.save(product);

      const loaded = await productRepo.findById(product.id);
      expect(loaded?.categoryIds.map((c) => c.value).sort()).toEqual(
        [catA.value, catB.value].sort(),
      );
      const byKey = Object.fromEntries(
        (loaded?.attributes.toArray() ?? []).map((a) => [a.key, a.value]),
      );
      expect(byKey).toEqual({ color: 'black', size: '6.1' });
    });

    it('replaces attributes/categories on subsequent save (no orphans)', async () => {
      const catA = await seedCategory(bed.dataSource, 'CatA');
      const catB = await seedCategory(bed.dataSource, 'CatB');

      const product = buildProduct({
        name: 'Phone',
        categoryIds: [catA],
        attributes: [Attribute.of('color', 'black')],
      });
      await productRepo.save(product);

      product.attachCategory(catB);
      product.detachCategory(catA);
      product.addAttribute(Attribute.of('size', '6.1'));
      product.removeAttribute('color');
      await productRepo.save(product);

      const loaded = await productRepo.findById(product.id);
      expect(loaded?.categoryIds.map((c) => c.value)).toEqual([catB.value]);
      const attrs = loaded?.attributes.toArray() ?? [];
      expect(attrs.map((a) => a.key)).toEqual(['size']);
      expect(attrs[0]?.value).toBe('6.1');

      const attrCount: Array<{ count: string }> = await bed.dataSource.query(
        `SELECT count(*)::text AS count FROM product_attribute WHERE product_id = $1`,
        [product.id.value],
      );
      expect(attrCount[0].count).toBe('1');

      const pcCount: Array<{ count: string }> = await bed.dataSource.query(
        `SELECT count(*)::text AS count FROM product_category WHERE product_id = $1`,
        [product.id.value],
      );
      expect(pcCount[0].count).toBe('1');
    });

    it('two DRAFTs with the same name coexist in the store', async () => {
      const name = 'TwinDraft';
      const p1 = buildProduct({ name });
      const p2 = buildProduct({ name });
      await productRepo.save(p1);
      await productRepo.save(p2);

      expect(await productRepo.findById(p1.id)).not.toBeNull();
      expect(await productRepo.findById(p2.id)).not.toBeNull();
    });

    it('existsOtherWithSameNameExcludingArchived ignores ARCHIVED products', async () => {
      const cat = await seedCategory(bed.dataSource, 'Cat');
      await productRepo.save(
        buildProduct({
          name: 'Reused',
          status: ProductStatus.ARCHIVED,
          categoryIds: [cat],
          attributes: [Attribute.of('k', 'v')],
        }),
      );

      const exists = await productRepo.existsOtherWithSameNameExcludingArchived(
        ProductName.of('Reused'),
        ProductId.of(randomUUID()),
      );
      expect(exists).toBe(false);
    });

    it('existsOtherWithSameNameExcludingArchived returns true when another DRAFT shares the name', async () => {
      const name = 'Clashing';
      const p1 = buildProduct({ name });
      const p2 = buildProduct({ name });
      await productRepo.save(p1);
      await productRepo.save(p2);

      const nameVO = ProductName.of(name);
      expect(await productRepo.existsOtherWithSameNameExcludingArchived(nameVO, p1.id)).toBe(true);
      expect(await productRepo.existsOtherWithSameNameExcludingArchived(nameVO, p2.id)).toBe(true);
    });

    it('existsOtherWithSameNameExcludingArchived excludes the product itself', async () => {
      const p = buildProduct({ name: 'Solo' });
      await productRepo.save(p);
      expect(
        await productRepo.existsOtherWithSameNameExcludingArchived(ProductName.of('Solo'), p.id),
      ).toBe(false);
    });

    it('returns null on findById when the product does not exist', async () => {
      expect(await productRepo.findById(ProductId.of(randomUUID()))).toBeNull();
    });

    // CRÍTICO 1 — atomicidade: FK violation em product_category deve rolar back o INSERT do product
    it('rolls back the whole transaction when a category_id FK is violated', async () => {
      const nonExistentCategoryId = CategoryId.of(randomUUID());
      const product = buildProduct({
        name: 'WillRollback',
        categoryIds: [nonExistentCategoryId],
        attributes: [Attribute.of('k', 'v')],
      });

      await expect(productRepo.save(product)).rejects.toThrow(/foreign key|violates.*constraint/i);

      // The product row must NOT exist — the INSERT was rolled back.
      const rows: Array<{ count: string }> = await bed.dataSource.query(
        `SELECT count(*)::text AS count FROM product WHERE id = $1`,
        [product.id.value],
      );
      expect(rows[0].count).toBe('0');
    });

    // MENOR 6 — replace-all com coleção vazia não deixa órfãos
    it('clears all attributes and categories when saved with empty collections', async () => {
      const catA = await seedCategory(bed.dataSource, 'ToRemove');
      const product = buildProduct({
        name: 'Stripped',
        categoryIds: [catA],
        attributes: [Attribute.of('color', 'red')],
      });
      await productRepo.save(product);

      const stripped = buildProduct({
        id: product.id,
        name: 'Stripped',
        categoryIds: [],
        attributes: [],
        status: product.status,
      });
      await productRepo.save(stripped);

      const attrCount: Array<{ count: string }> = await bed.dataSource.query(
        `SELECT count(*)::text AS count FROM product_attribute WHERE product_id = $1`,
        [product.id.value],
      );
      expect(attrCount[0].count).toBe('0');

      const pcCount: Array<{ count: string }> = await bed.dataSource.query(
        `SELECT count(*)::text AS count FROM product_category WHERE product_id = $1`,
        [product.id.value],
      );
      expect(pcCount[0].count).toBe('0');
    });

    it('blocks promoting two products to ACTIVE with the same name (DB partial unique index)', async () => {
      const catA = await seedCategory(bed.dataSource, 'A');
      const catB = await seedCategory(bed.dataSource, 'B');
      const name = 'OnlyOneActive';

      await productRepo.save(
        buildProduct({
          name,
          status: ProductStatus.ACTIVE,
          categoryIds: [catA],
          attributes: [Attribute.of('k', 'v')],
        }),
      );

      await expect(
        productRepo.save(
          buildProduct({
            name,
            status: ProductStatus.ACTIVE,
            categoryIds: [catB],
            attributes: [Attribute.of('k', 'v')],
          }),
        ),
      ).rejects.toThrow(/duplicate key|unique/i);
    });

    it('archiving releases the partial-unique slot, freeing the name for activation', async () => {
      const catA = await seedCategory(bed.dataSource, 'A');
      const name = 'Recycled';
      const id1 = ProductId.of(randomUUID());

      await productRepo.save(
        buildProduct({
          id: id1,
          name,
          status: ProductStatus.ACTIVE,
          categoryIds: [catA],
          attributes: [Attribute.of('k', 'v')],
        }),
      );
      await productRepo.save(
        buildProduct({
          id: id1,
          name,
          status: ProductStatus.ARCHIVED,
          categoryIds: [catA],
          attributes: [Attribute.of('k', 'v')],
        }),
      );

      await expect(
        productRepo.save(
          buildProduct({
            name,
            status: ProductStatus.ACTIVE,
            categoryIds: [catA],
            attributes: [Attribute.of('k', 'v')],
          }),
        ),
      ).resolves.toBeUndefined();
    });
  });
});
