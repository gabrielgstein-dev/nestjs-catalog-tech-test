import { MigrationInterface, QueryRunner } from 'typeorm';

export class SkeletonTables1716552000000 implements MigrationInterface {
  name = 'SkeletonTables1716552000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "skeleton_ping" (
        "id" uuid NOT NULL,
        "correlationId" varchar(64) NOT NULL,
        "payload" varchar(255) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_skeleton_ping" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "skeleton_ack" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pingId" uuid NOT NULL,
        "correlationId" varchar(64) NOT NULL,
        "status" varchar(32) NOT NULL,
        "ackedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_skeleton_ack" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_skeleton_ack_pingId" ON "skeleton_ack" ("pingId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_skeleton_ack_pingId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "skeleton_ack"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "skeleton_ping"`);
  }
}
