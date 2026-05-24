import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

jest.setTimeout(180_000);

describe('Catalog persistence (integration)', () => {
  let postgres: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('catalog')
      .withUsername('catalog')
      .withPassword('catalog')
      .start();

    dataSource = new DataSource({
      type: 'postgres',
      host: postgres.getHost(),
      port: postgres.getMappedPort(5432),
      username: postgres.getUsername(),
      password: postgres.getPassword(),
      database: postgres.getDatabase(),
      entities: [join(__dirname, '../src/modules/**/infra/entities/*.entity.ts')],
      migrations: [join(__dirname, '../src/shared/infra/database/migrations/*.ts')],
      synchronize: false,
      logging: ['error'],
    });

    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await postgres?.stop();
  });

  describe('schema', () => {
    it('creates all expected catalog tables', async () => {
      const rows: Array<{ table_name: string }> = await dataSource.query(
        `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name IN
             ('category','product','product_attribute','product_category','outbox')
           ORDER BY table_name`,
      );
      const names = rows.map((r) => r.table_name);
      expect(names).toEqual([
        'category',
        'outbox',
        'product',
        'product_attribute',
        'product_category',
      ]);
    });

    it('creates the partial unique index on ACTIVE product names', async () => {
      const rows: Array<{ indexdef: string }> = await dataSource.query(
        `SELECT indexdef FROM pg_indexes
           WHERE schemaname = 'public' AND indexname = 'uq_product_name_active'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].indexdef).toMatch(/WHERE.*status.*=.*'ACTIVE'/i);
    });

    it('allows two DRAFT products with the same name at the DB level', async () => {
      const a = randomUUID();
      const b = randomUUID();
      await dataSource.query(
        `INSERT INTO product (id, name, status) VALUES ($1, 'same', 'DRAFT'), ($2, 'same', 'DRAFT')`,
        [a, b],
      );
      const rows: Array<{ count: string }> = await dataSource.query(
        `SELECT count(*)::text AS count FROM product WHERE name = 'same' AND status = 'DRAFT'`,
      );
      expect(rows[0].count).toBe('2');
      await dataSource.query(`DELETE FROM product WHERE id IN ($1, $2)`, [a, b]);
    });

    it('rejects two ACTIVE products with the same name (partial unique index)', async () => {
      const a = randomUUID();
      const b = randomUUID();
      // Cannot insert as ACTIVE directly without categories/attributes from the domain side,
      // but the DB-level constraint is independent — test it raw.
      await dataSource.query(
        `INSERT INTO product (id, name, status) VALUES ($1, 'unique-active', 'ACTIVE')`,
        [a],
      );
      await expect(
        dataSource.query(
          `INSERT INTO product (id, name, status) VALUES ($1, 'unique-active', 'ACTIVE')`,
          [b],
        ),
      ).rejects.toThrow(/duplicate key|unique/i);
      await dataSource.query(`DELETE FROM product WHERE id = $1`, [a]);
    });
  });
});
