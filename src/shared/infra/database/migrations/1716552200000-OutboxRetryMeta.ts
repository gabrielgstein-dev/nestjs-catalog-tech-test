import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutboxRetryMeta1716552200000 implements MigrationInterface {
  name = 'OutboxRetryMeta1716552200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "outbox" ADD COLUMN IF NOT EXISTS "last_error" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "outbox" DROP COLUMN IF EXISTS "last_error"`);
  }
}
