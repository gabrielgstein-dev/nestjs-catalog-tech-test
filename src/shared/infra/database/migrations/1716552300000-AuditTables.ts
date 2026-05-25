import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditTables1716552300000 implements MigrationInterface {
  name = 'AuditTables1716552300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "aggregate_type" varchar(64) NOT NULL,
        "aggregate_id" varchar(128) NOT NULL,
        "event_type" varchar(128) NOT NULL,
        "payload" jsonb NOT NULL,
        "correlation_id" varchar(64),
        "occurred_at" timestamptz NOT NULL,
        "recorded_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_log" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_log_aggregate"
         ON "audit_log" ("aggregate_type", "aggregate_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_log_event_type"
         ON "audit_log" ("event_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_log_correlation"
         ON "audit_log" ("correlation_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "processed_event" (
        "event_id" uuid NOT NULL,
        "consumer" varchar(64) NOT NULL,
        "processed_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processed_event" PRIMARY KEY ("event_id", "consumer")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "processed_event"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_log_correlation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_log_event_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_log_aggregate"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log"`);
  }
}
