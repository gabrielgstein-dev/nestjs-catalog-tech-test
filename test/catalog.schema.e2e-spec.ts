import { randomUUID } from 'node:crypto';
import { CatalogTestBed, startCatalogTestBed } from './helpers/catalog-test-bed';

jest.setTimeout(180_000);

describe('Catalog schema (integration)', () => {
  let bed: CatalogTestBed;

  beforeAll(async () => {
    bed = await startCatalogTestBed();
  });

  afterAll(async () => {
    await bed?.stop();
  });

  it('creates all expected catalog tables', async () => {
    const rows: Array<{ table_name: string }> = await bed.dataSource.query(
      `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name IN
           ('category','product','product_attribute','product_category','outbox')
         ORDER BY table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      'category',
      'outbox',
      'product',
      'product_attribute',
      'product_category',
    ]);
  });

  it('creates the partial unique index on ACTIVE product names', async () => {
    const rows: Array<{ indexdef: string }> = await bed.dataSource.query(
      `SELECT indexdef FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = 'uq_product_name_active'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toMatch(/WHERE.*status.*=.*'ACTIVE'/i);
  });

  it('allows two DRAFT products with the same name at the DB level', async () => {
    const a = randomUUID();
    const b = randomUUID();
    await bed.dataSource.query(
      `INSERT INTO product (id, name, status) VALUES ($1, 'same', 'DRAFT'), ($2, 'same', 'DRAFT')`,
      [a, b],
    );
    const rows: Array<{ count: string }> = await bed.dataSource.query(
      `SELECT count(*)::text AS count FROM product WHERE name = 'same' AND status = 'DRAFT'`,
    );
    expect(rows[0].count).toBe('2');
    await bed.dataSource.query(`DELETE FROM product WHERE id IN ($1, $2)`, [a, b]);
  });

  it('rejects two ACTIVE products with the same name (partial unique index)', async () => {
    const a = randomUUID();
    const b = randomUUID();
    await bed.dataSource.query(
      `INSERT INTO product (id, name, status) VALUES ($1, 'unique-active', 'ACTIVE')`,
      [a],
    );
    await expect(
      bed.dataSource.query(
        `INSERT INTO product (id, name, status) VALUES ($1, 'unique-active', 'ACTIVE')`,
        [b],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
    await bed.dataSource.query(`DELETE FROM product WHERE id = $1`, [a]);
  });

  it('enforces (product_id, key) primary key on product_attribute', async () => {
    const productId = randomUUID();
    await bed.dataSource.query(
      `INSERT INTO product (id, name, status) VALUES ($1, 'attr-test', 'DRAFT')`,
      [productId],
    );
    await bed.dataSource.query(
      `INSERT INTO product_attribute (product_id, key, value) VALUES ($1, 'color', 'black')`,
      [productId],
    );
    await expect(
      bed.dataSource.query(
        `INSERT INTO product_attribute (product_id, key, value) VALUES ($1, 'color', 'red')`,
        [productId],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
    await bed.dataSource.query(`DELETE FROM product WHERE id = $1`, [productId]);
  });

  it('rejects invalid product status values via CHECK constraint', async () => {
    await expect(
      bed.dataSource.query(`INSERT INTO product (id, name, status) VALUES ($1, 'bad', 'BOGUS')`, [
        randomUUID(),
      ]),
    ).rejects.toThrow(/check constraint|CK_product_status/i);
  });
});
