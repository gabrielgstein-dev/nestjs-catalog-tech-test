import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogTables1716552100000 implements MigrationInterface {
  name = 'CatalogTables1716552100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "category" (
        "id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "parent_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_category" PRIMARY KEY ("id"),
        CONSTRAINT "FK_category_parent" FOREIGN KEY ("parent_id")
          REFERENCES "category" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_category_name" ON "category" ("name")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product" (
        "id" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "description" text,
        "status" varchar(16) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product" PRIMARY KEY ("id"),
        CONSTRAINT "CK_product_status" CHECK ("status" IN ('DRAFT','ACTIVE','ARCHIVED'))
      )
    `);

    // Partial unique index: name uniqueness is an ACTIVATION gate.
    // - DRAFT products may share names (allowed by domain).
    // - ARCHIVED products release the name.
    // - Two ACTIVE products with the same name are forbidden — this index
    //   resolves the race window between concurrent activations.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_product_name_active"
         ON "product" ("name") WHERE "status" = 'ACTIVE'`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_attribute" (
        "product_id" uuid NOT NULL,
        "key" varchar(100) NOT NULL,
        "value" varchar(500) NOT NULL,
        CONSTRAINT "PK_product_attribute" PRIMARY KEY ("product_id", "key"),
        CONSTRAINT "FK_product_attribute_product" FOREIGN KEY ("product_id")
          REFERENCES "product" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_category" (
        "product_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        CONSTRAINT "PK_product_category" PRIMARY KEY ("product_id", "category_id"),
        CONSTRAINT "FK_product_category_product" FOREIGN KEY ("product_id")
          REFERENCES "product" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_category_category" FOREIGN KEY ("category_id")
          REFERENCES "category" ("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_product_category_category_id"
         ON "product_category" ("category_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "aggregate_type" varchar(64) NOT NULL,
        "aggregate_id" varchar(128) NOT NULL,
        "event_type" varchar(128) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'PENDING',
        "occurred_at" timestamptz NOT NULL DEFAULT now(),
        "processed_at" timestamptz,
        "attempts" integer NOT NULL DEFAULT 0,
        "correlation_id" varchar(64),
        CONSTRAINT "PK_outbox" PRIMARY KEY ("id"),
        CONSTRAINT "CK_outbox_status" CHECK ("status" IN ('PENDING','PROCESSED','FAILED'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_outbox_status_occurred_at"
         ON "outbox" ("status", "occurred_at")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_outbox_aggregate"
         ON "outbox" ("aggregate_type", "aggregate_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_outbox_aggregate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_outbox_status_occurred_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_category_category_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_category"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_attribute"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "uq_product_name_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "uq_category_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "category"`);
  }
}
