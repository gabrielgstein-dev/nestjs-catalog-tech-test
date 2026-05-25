import request from 'supertest';
import { CatalogHttpTestBed, startCatalogHttpTestBed } from './helpers/catalog-http-test-bed';

jest.setTimeout(240_000);

/**
 * Partial-PATCH semantics: a field ABSENT from the JSON body must not touch
 * the underlying attribute; a field PRESENT (including with `null`) must be
 * dispatched as an intent. We can't rely on Object.hasOwnProperty against the
 * DTO instance because ES2022 class fields create own properties for every
 * declared optional field — detection has to come from the raw JSON body.
 */
describe('Catalog HTTP API — partial PATCH semantics (e2e)', () => {
  let bed: CatalogHttpTestBed;
  let server: CatalogHttpTestBed['server'];

  beforeAll(async () => {
    bed = await startCatalogHttpTestBed();
    server = bed.server;
  });
  afterEach(() => bed.truncate());
  afterAll(() => bed?.close());

  describe('/categories — name vs parentId presence is independent', () => {
    it('PATCH with only name renames and DOES NOT touch parentId', async () => {
      const parent = await request(server)
        .post('/categories')
        .send({ name: 'TopLevel' })
        .expect(201);
      const child = await request(server)
        .post('/categories')
        .send({ name: 'OldName', parentId: parent.body.id })
        .expect(201);

      const res = await request(server)
        .patch(`/categories/${child.body.id}`)
        .send({ name: 'NewName' })
        .expect(200);

      expect(res.body.name).toBe('NewName');
      expect(res.body.parentId).toBe(parent.body.id);
    });

    it('PATCH with only parentId moves the node WITHOUT renaming', async () => {
      const parent = await request(server).post('/categories').send({ name: 'Parent' }).expect(201);
      const child = await request(server)
        .post('/categories')
        .send({ name: 'KeepThisName' })
        .expect(201);

      const res = await request(server)
        .patch(`/categories/${child.body.id}`)
        .send({ parentId: parent.body.id })
        .expect(200);

      expect(res.body.name).toBe('KeepThisName');
      expect(res.body.parentId).toBe(parent.body.id);
    });

    it('PATCH with parentId: null detaches from the parent (becomes a root category)', async () => {
      const parent = await request(server).post('/categories').send({ name: 'Root' }).expect(201);
      const child = await request(server)
        .post('/categories')
        .send({ name: 'Leaf', parentId: parent.body.id })
        .expect(201);

      const res = await request(server)
        .patch(`/categories/${child.body.id}`)
        .send({ parentId: null })
        .expect(200);

      expect(res.body.parentId).toBeNull();
    });

    it('PATCH with an empty body is a no-op (preserves both name and parentId)', async () => {
      const parent = await request(server)
        .post('/categories')
        .send({ name: 'AnotherTop' })
        .expect(201);
      const child = await request(server)
        .post('/categories')
        .send({ name: 'StaysTheSame', parentId: parent.body.id })
        .expect(201);

      const res = await request(server).patch(`/categories/${child.body.id}`).send({}).expect(200);

      expect(res.body.name).toBe('StaysTheSame');
      expect(res.body.parentId).toBe(parent.body.id);
    });
  });

  describe('/products — name vs description presence is independent', () => {
    it('PATCH with only description updates it and PRESERVES the name', async () => {
      const created = await request(server)
        .post('/products')
        .send({ name: 'KeepMyName' })
        .expect(201);

      const res = await request(server)
        .patch(`/products/${created.body.id}`)
        .send({ description: 'just describe me' })
        .expect(200);

      expect(res.body.name).toBe('KeepMyName');
      expect(res.body.description).toBe('just describe me');
    });

    it('PATCH with only name renames and PRESERVES the description (the Phase-7 regression)', async () => {
      const created = await request(server)
        .post('/products')
        .send({ name: 'BeforeName', description: 'unchanged through the rename' })
        .expect(201);

      const res = await request(server)
        .patch(`/products/${created.body.id}`)
        .send({ name: 'AfterName' })
        .expect(200);

      expect(res.body.name).toBe('AfterName');
      expect(res.body.description).toBe('unchanged through the rename');
    });

    it('PATCH with description: null clears the description and PRESERVES the name', async () => {
      const created = await request(server)
        .post('/products')
        .send({ name: 'StillNamed', description: 'about to be cleared' })
        .expect(201);

      const res = await request(server)
        .patch(`/products/${created.body.id}`)
        .send({ description: null })
        .expect(200);

      expect(res.body.name).toBe('StillNamed');
      expect(res.body.description).toBeNull();
    });

    it('PATCH with an empty body is a no-op (preserves both name and description)', async () => {
      const created = await request(server)
        .post('/products')
        .send({ name: 'Untouched', description: 'also untouched' })
        .expect(201);

      const res = await request(server).patch(`/products/${created.body.id}`).send({}).expect(200);

      expect(res.body.name).toBe('Untouched');
      expect(res.body.description).toBe('also untouched');
    });
  });
});
