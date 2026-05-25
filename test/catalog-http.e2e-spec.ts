import request from 'supertest';
import { CatalogHttpTestBed, startCatalogHttpTestBed } from './helpers/catalog-http-test-bed';
import { waitFor } from './helpers/messaging-test-bed';

jest.setTimeout(240_000);

describe('Catalog HTTP API (e2e)', () => {
  let bed: CatalogHttpTestBed;
  let server: CatalogHttpTestBed['server'];

  beforeAll(async () => {
    bed = await startCatalogHttpTestBed();
    server = bed.server;
  });
  afterEach(() => bed.truncate());
  afterAll(() => bed?.close());

  describe('happy path: create -> categorize -> attribute -> activate -> archive', () => {
    it('walks the full lifecycle through HTTP', async () => {
      const catRes = await request(server)
        .post('/categories')
        .send({ name: 'Electronics' })
        .expect(201);
      expect(catRes.body).toMatchObject({ name: 'Electronics', parentId: null });
      const categoryId: string = catRes.body.id;

      const prodRes = await request(server)
        .post('/products')
        .send({ name: 'iPhone 15', description: 'Apple flagship' })
        .expect(201);
      expect(prodRes.body).toMatchObject({
        name: 'iPhone 15',
        description: 'Apple flagship',
        status: 'DRAFT',
        categoryIds: [],
        attributes: [],
      });
      const productId: string = prodRes.body.id;

      await request(server)
        .post(`/products/${productId}/categories`)
        .send({ categoryId })
        .expect(204);

      const addAttrRes = await request(server)
        .post(`/products/${productId}/attributes`)
        .send({ key: 'color', value: 'silver' })
        .expect(201);
      expect(addAttrRes.body.attributes).toEqual([{ key: 'color', value: 'silver' }]);
      expect(addAttrRes.body.categoryIds).toEqual([categoryId]);

      await request(server).post(`/products/${productId}/activate`).expect(204);
      const activated = await request(server).get(`/products/${productId}`).expect(200);
      expect(activated.body.status).toBe('ACTIVE');

      await request(server).post(`/products/${productId}/archive`).expect(204);
      const archived = await request(server).get(`/products/${productId}`).expect(200);
      expect(archived.body.status).toBe('ARCHIVED');
    });

    it('updates attribute via PATCH and removes via DELETE', async () => {
      const cat = await request(server).post('/categories').send({ name: 'Books' }).expect(201);
      const prod = await request(server).post('/products').send({ name: 'A Book' }).expect(201);
      const pid: string = prod.body.id;
      await request(server)
        .post(`/products/${pid}/categories`)
        .send({ categoryId: cat.body.id })
        .expect(204);
      await request(server)
        .post(`/products/${pid}/attributes`)
        .send({ key: 'isbn', value: '111-1' })
        .expect(201);
      await request(server)
        .post(`/products/${pid}/attributes`)
        .send({ key: 'pages', value: '320' })
        .expect(201);
      const updated = await request(server)
        .patch(`/products/${pid}/attributes/isbn`)
        .send({ value: '222-2' })
        .expect(200);
      expect(updated.body.attributes.find((a: { key: string }) => a.key === 'isbn').value).toBe(
        '222-2',
      );
      await request(server).delete(`/products/${pid}/attributes/pages`).expect(204);
      const after = await request(server).get(`/products/${pid}`).expect(200);
      expect(after.body.attributes.map((a: { key: string }) => a.key)).toEqual(['isbn']);
    });
  });

  describe('full lifecycle via HTTP -> audit_log persisted with correlationId for every hop', () => {
    it('walks create -> categorize -> attribute -> activate -> archive and persists ONE audit_log row per domain event sharing the same correlationId', async () => {
      const corr = 'lifecycle-audit-1';

      const cat = await request(server)
        .post('/categories')
        .set('x-correlation-id', corr)
        .send({ name: 'AuditedCategory' })
        .expect(201);
      const categoryId: string = cat.body.id;

      const prod = await request(server)
        .post('/products')
        .set('x-correlation-id', corr)
        .send({ name: 'AuditedProduct', description: 'tracked end to end' })
        .expect(201);
      const productId: string = prod.body.id;

      await request(server)
        .post(`/products/${productId}/categories`)
        .set('x-correlation-id', corr)
        .send({ categoryId })
        .expect(204);

      await request(server)
        .post(`/products/${productId}/attributes`)
        .set('x-correlation-id', corr)
        .send({ key: 'color', value: 'silver' })
        .expect(201);

      await request(server)
        .post(`/products/${productId}/activate`)
        .set('x-correlation-id', corr)
        .expect(204);

      await request(server)
        .post(`/products/${productId}/archive`)
        .set('x-correlation-id', corr)
        .expect(204);

      const final = await request(server).get(`/products/${productId}`).expect(200);
      expect(final.body.status).toBe('ARCHIVED');
      expect(final.body.categoryIds).toEqual([categoryId]);
      expect(final.body.attributes).toEqual([{ key: 'color', value: 'silver' }]);

      // Audit asynchronously drains 6 events (1 on the category + 5 on the product).
      const auditRows = await waitFor(
        async () => {
          const rows: Array<{ event_type: string; correlation_id: string | null }> =
            await bed.dataSource.query(
              `SELECT event_type, correlation_id
                 FROM audit_log
                WHERE aggregate_id IN ($1, $2)
                ORDER BY recorded_at ASC`,
              [productId, categoryId],
            );
          return rows.length >= 6 ? rows : null;
        },
        { label: 'audit_log drained for full lifecycle', timeoutMs: 30_000 },
      );

      expect(auditRows.map((r) => r.event_type).sort()).toEqual(
        [
          'catalog.category.created',
          'catalog.product.created',
          'catalog.product.category_attached',
          'catalog.product.attribute_added',
          'catalog.product.activated',
          'catalog.product.archived',
        ].sort(),
      );

      // Every single hop carried the same correlationId end to end.
      const distinctCorrIds = new Set(auditRows.map((r) => r.correlation_id));
      expect(distinctCorrIds.size).toBe(1);
      expect(distinctCorrIds.has(corr)).toBe(true);

      // Idempotency at the audit boundary: each event_id processed exactly once.
      const processed: Array<{ count: string }> = await bed.dataSource.query(
        `SELECT count(DISTINCT event_id)::text AS count FROM audit_log
          WHERE aggregate_id IN ($1, $2)`,
        [productId, categoryId],
      );
      expect(processed[0].count).toBe('6');

      // And the outbox has fully drained — no stragglers.
      const pending: Array<{ count: string }> = await bed.dataSource.query(
        `SELECT count(*)::text AS count FROM outbox
          WHERE aggregate_id IN ($1, $2) AND status <> 'PROCESSED'`,
        [productId, categoryId],
      );
      expect(pending[0].count).toBe('0');
    });
  });

  describe('input validation -> 400', () => {
    it('rejects empty product name', async () => {
      const res = await request(server).post('/products').send({ name: '' }).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(res.body.correlationId).toEqual(expect.any(String));
      expect(res.body.timestamp).toEqual(expect.any(String));
      expect(res.body.path).toBe('/products');
    });

    it('rejects unknown fields (forbidNonWhitelisted)', async () => {
      await request(server).post('/products').send({ name: 'X', evil: 'p' }).expect(400);
    });

    it('rejects malformed UUID in path', async () => {
      await request(server).get('/products/not-a-uuid').expect(400);
    });

    it('rejects non-UUID categoryId in attach body', async () => {
      const prod = await request(server).post('/products').send({ name: 'Z' }).expect(201);
      await request(server)
        .post(`/products/${prod.body.id}/categories`)
        .send({ categoryId: 'nope' })
        .expect(400);
    });
  });

  describe('domain errors -> HTTP mapping', () => {
    it('activating without category/attribute -> 409', async () => {
      const prod = await request(server).post('/products').send({ name: 'Empty' }).expect(201);
      const res = await request(server).post(`/products/${prod.body.id}/activate`).expect(409);
      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        code: 'product.cannot_be_activated',
      });
      expect(res.body.correlationId).toEqual(expect.any(String));
    });

    it('activating with category but no attribute -> 409', async () => {
      const cat = await request(server).post('/categories').send({ name: 'Cat' }).expect(201);
      const prod = await request(server)
        .post('/products')
        .send({ name: 'WithCatOnly' })
        .expect(201);
      await request(server)
        .post(`/products/${prod.body.id}/categories`)
        .send({ categoryId: cat.body.id })
        .expect(204);
      const res = await request(server).post(`/products/${prod.body.id}/activate`).expect(409);
      expect(res.body.code).toBe('product.cannot_be_activated');
    });

    it('duplicate attribute key -> 409', async () => {
      const prod = await request(server).post('/products').send({ name: 'Dup' }).expect(201);
      await request(server)
        .post(`/products/${prod.body.id}/attributes`)
        .send({ key: 'size', value: 'L' })
        .expect(201);
      const res = await request(server)
        .post(`/products/${prod.body.id}/attributes`)
        .send({ key: 'size', value: 'XL' })
        .expect(409);
      expect(res.body.code).toBe('product.duplicate_attribute_key');
    });

    it('editing an archived product respects ARCHIVED immutability', async () => {
      const cat = await request(server).post('/categories').send({ name: 'Cat2' }).expect(201);
      const prod = await request(server).post('/products').send({ name: 'Archivable' }).expect(201);
      const pid: string = prod.body.id;
      await request(server)
        .post(`/products/${pid}/categories`)
        .send({ categoryId: cat.body.id })
        .expect(204);
      await request(server)
        .post(`/products/${pid}/attributes`)
        .send({ key: 'k', value: 'v' })
        .expect(201);
      await request(server).post(`/products/${pid}/archive`).expect(204);

      // description is allowed
      await request(server)
        .patch(`/products/${pid}`)
        .send({ description: 'new desc allowed' })
        .expect(200);

      const renameRes = await request(server)
        .patch(`/products/${pid}`)
        .send({ name: 'forbidden' })
        .expect(409);
      expect(renameRes.body.code).toBe('product.archived_is_immutable');

      const addRes = await request(server)
        .post(`/products/${pid}/attributes`)
        .send({ key: 'k2', value: 'v2' })
        .expect(409);
      expect(addRes.body.code).toBe('product.archived_is_immutable');
    });

    it('parent category that does not exist -> 404', async () => {
      const missing = '00000000-0000-4000-8000-000000000000';
      const res = await request(server)
        .post('/categories')
        .send({ name: 'Orphan', parentId: missing })
        .expect(404);
      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        code: 'category.parent_not_found',
      });
    });

    it('duplicate category name -> 409', async () => {
      await request(server).post('/categories').send({ name: 'Repeat' }).expect(201);
      const dup = await request(server).post('/categories').send({ name: 'Repeat' }).expect(409);
      expect(dup.body.code).toBe('category.duplicate_name');
    });

    it('GET on missing product -> 404 with correlationId', async () => {
      const missing = '00000000-0000-4000-8000-000000000001';
      const res = await request(server).get(`/products/${missing}`).expect(404);
      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        code: 'product.not_found',
      });
      expect(res.body.correlationId).toEqual(expect.any(String));
    });
  });

  describe('correlationId end-to-end', () => {
    it('echoes provided x-correlation-id in success and error responses', async () => {
      const corr = 'e2e-cat-corr-1';
      const ok = await request(server)
        .post('/categories')
        .set('x-correlation-id', corr)
        .send({ name: 'Tagged' })
        .expect(201);
      expect(ok.headers['x-correlation-id']).toBe(corr);
      const err = await request(server)
        .post('/categories')
        .set('x-correlation-id', corr)
        .send({ name: 'Tagged' })
        .expect(409);
      expect(err.headers['x-correlation-id']).toBe(corr);
      expect(err.body.correlationId).toBe(corr);
    });
  });

  describe('list endpoints', () => {
    it('GET /categories returns a page', async () => {
      await request(server).post('/categories').send({ name: 'B' }).expect(201);
      await request(server).post('/categories').send({ name: 'A' }).expect(201);
      const res = await request(server).get('/categories?limit=10&offset=0').expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['A', 'B']);
    });

    it('GET /categories with no query params uses the default limit/offset', async () => {
      await request(server).post('/categories').send({ name: 'Alpha' }).expect(201);
      const res = await request(server).get('/categories').expect(200);
      expect(res.body.limit).toBe(50);
      expect(res.body.offset).toBe(0);
      expect(res.body.total).toBe(1);
    });

    it('GET /products returns a page filterable by status', async () => {
      await request(server).post('/products').send({ name: 'P1' }).expect(201);
      await request(server).post('/products').send({ name: 'P2' }).expect(201);
      const draft = await request(server).get('/products?status=DRAFT').expect(200);
      expect(draft.body.total).toBe(2);
      const active = await request(server).get('/products?status=ACTIVE').expect(200);
      expect(active.body.total).toBe(0);
    });

    it('GET /products with no query params lists every product (default limit/offset, no status filter)', async () => {
      await request(server).post('/products').send({ name: 'P-default' }).expect(201);
      const res = await request(server).get('/products').expect(200);
      expect(res.body.limit).toBe(50);
      expect(res.body.offset).toBe(0);
      expect(res.body.total).toBe(1);
    });

    it('GET /products with a non-numeric limit falls back to the default (NaN guard)', async () => {
      await request(server).post('/products').send({ name: 'P-guard' }).expect(201);
      const res = await request(server).get('/products?limit=foo&offset=bar').expect(200);
      expect(res.body.limit).toBe(50);
      expect(res.body.offset).toBe(0);
    });

    it('GET /products with an unknown status string treats it as no filter', async () => {
      await request(server).post('/products').send({ name: 'P-unknown' }).expect(201);
      const res = await request(server).get('/products?status=BANANA').expect(200);
      expect(res.body.total).toBe(1);
    });
  });

  describe('health and docs', () => {
    it('/health reports DB and RabbitMQ as up', async () => {
      const res = await request(server).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.info?.database?.status).toBe('up');
      expect(res.body.info?.rabbitmq?.status).toBe('up');
    });
  });
});
