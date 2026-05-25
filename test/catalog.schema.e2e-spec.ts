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

  // Helper: insert a product row directly (no domain layer)
  async function insertProduct(id: string, name: string, status = 'DRAFT'): Promise<void> {
    await bed.dataSource.query(`INSERT INTO product (id, name, status) VALUES ($1, $2, $3)`, [
      id,
      name,
      status,
    ]);
  }

  // Helper: insert a category row directly
  async function insertCategory(
    id: string,
    name: string,
    parentId: string | null = null,
  ): Promise<void> {
    await bed.dataSource.query(`INSERT INTO category (id, name, parent_id) VALUES ($1, $2, $3)`, [
      id,
      name,
      parentId,
    ]);
  }

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

  // ── CRÍTICO 2 — FK behaviour ──────────────────────────────────────────────

  it('rejects INSERT into product_category with a non-existent category_id (FK RESTRICT)', async () => {
    const productId = randomUUID();
    await insertProduct(productId, 'fk-test');
    await expect(
      bed.dataSource.query(
        `INSERT INTO product_category (product_id, category_id) VALUES ($1, $2)`,
        [productId, randomUUID()],
      ),
    ).rejects.toThrow(/foreign key|violates/i);
    await bed.dataSource.query(`DELETE FROM product WHERE id = $1`, [productId]);
  });

  it('deleting a category with a linked product fails (product_category ON DELETE RESTRICT)', async () => {
    const catId = randomUUID();
    const productId = randomUUID();
    await insertCategory(catId, 'restrict-cat');
    await insertProduct(productId, 'linked-product');
    await bed.dataSource.query(
      `INSERT INTO product_category (product_id, category_id) VALUES ($1, $2)`,
      [productId, catId],
    );
    await expect(
      bed.dataSource.query(`DELETE FROM category WHERE id = $1`, [catId]),
    ).rejects.toThrow(/foreign key|violates/i);
    // cleanup
    await bed.dataSource.query(`DELETE FROM product WHERE id = $1`, [productId]);
    await bed.dataSource.query(`DELETE FROM category WHERE id = $1`, [catId]);
  });

  it('deleting a product cascades to product_attribute and product_category', async () => {
    const catId = randomUUID();
    const productId = randomUUID();
    await insertCategory(catId, 'cascade-cat');
    await insertProduct(productId, 'cascade-product');
    await bed.dataSource.query(
      `INSERT INTO product_attribute (product_id, key, value) VALUES ($1, 'k', 'v')`,
      [productId],
    );
    await bed.dataSource.query(
      `INSERT INTO product_category (product_id, category_id) VALUES ($1, $2)`,
      [productId, catId],
    );

    await bed.dataSource.query(`DELETE FROM product WHERE id = $1`, [productId]);

    const attrCount: Array<{ count: string }> = await bed.dataSource.query(
      `SELECT count(*)::text AS count FROM product_attribute WHERE product_id = $1`,
      [productId],
    );
    const pcCount: Array<{ count: string }> = await bed.dataSource.query(
      `SELECT count(*)::text AS count FROM product_category WHERE product_id = $1`,
      [productId],
    );
    expect(attrCount[0].count).toBe('0');
    expect(pcCount[0].count).toBe('0');
    await bed.dataSource.query(`DELETE FROM category WHERE id = $1`, [catId]);
  });

  it('deleting a parent category sets child parent_id to NULL (ON DELETE SET NULL)', async () => {
    const parentId = randomUUID();
    const childId = randomUUID();
    await insertCategory(parentId, 'parent-cat');
    await insertCategory(childId, 'child-cat', parentId);

    await bed.dataSource.query(`DELETE FROM category WHERE id = $1`, [parentId]);

    const rows: Array<{ parent_id: string | null }> = await bed.dataSource.query(
      `SELECT parent_id FROM category WHERE id = $1`,
      [childId],
    );
    expect(rows[0].parent_id).toBeNull();
    await bed.dataSource.query(`DELETE FROM category WHERE id = $1`, [childId]);
  });

  // ── MENOR 4 — outbox defaults, CHECK and jsonb roundtrip ─────────────────

  it('outbox row gets gen_random_uuid id, status=PENDING and attempts=0 by default', async () => {
    const rows: Array<{ id: string; status: string; attempts: number }> =
      await bed.dataSource.query(
        `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
           VALUES ('Product', $1, 'ProductCreated', $2)
         RETURNING id, status, attempts`,
        [randomUUID(), JSON.stringify({ foo: 'bar' })],
      );
    expect(rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(rows[0].status).toBe('PENDING');
    expect(rows[0].attempts).toBe(0);
    await bed.dataSource.query(`DELETE FROM outbox WHERE id = $1`, [rows[0].id]);
  });

  it('outbox rejects invalid status via CHECK constraint', async () => {
    await expect(
      bed.dataSource.query(
        `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload, status)
           VALUES ('Product', $1, 'ProductCreated', $2, 'NOPE')`,
        [randomUUID(), JSON.stringify({})],
      ),
    ).rejects.toThrow(/check constraint|CK_outbox_status/i);
  });

  it('outbox jsonb payload roundtrips correctly', async () => {
    const payload = { productId: randomUUID(), name: 'Test', nested: { x: 1 } };
    const rows: Array<{ id: string; payload: unknown }> = await bed.dataSource.query(
      `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
         VALUES ('Product', $1, 'ProductCreated', $2)
       RETURNING id, payload`,
      [randomUUID(), JSON.stringify(payload)],
    );
    expect(rows[0].payload).toEqual(payload);
    await bed.dataSource.query(`DELETE FROM outbox WHERE id = $1`, [rows[0].id]);
  });

  // ── CRÍTICO 5 — migration down() ─────────────────────────────────────────

  it('migration down() drops all catalog tables and reverts cleanly', async () => {
    // Undo every migration applied after CatalogTables (audit_log, processed_event,
    // outbox.last_error) and CatalogTables itself, so we can prove its down() does
    // drop the catalog tables.
    await bed.dataSource.undoLastMigration(); // AuditTables
    await bed.dataSource.undoLastMigration(); // OutboxRetryMeta
    await bed.dataSource.undoLastMigration(); // CatalogTables

    const rows: Array<{ table_name: string }> = await bed.dataSource.query(
      `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('category','product','product_attribute','product_category','outbox')
         ORDER BY table_name`,
    );
    expect(rows).toHaveLength(0);

    // Re-run so the rest of the suite can keep working
    await bed.dataSource.runMigrations();
  });

  // ── MENOR 8 — migration idempotência ─────────────────────────────────────

  it('running migrations twice does not fail (IF NOT EXISTS guards)', async () => {
    await expect(bed.dataSource.runMigrations()).resolves.not.toThrow();
  });
});
