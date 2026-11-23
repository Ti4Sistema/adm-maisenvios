import { MigrationInterface, QueryRunner } from "typeorm";

export class HideRegistrations1794923103158 implements MigrationInterface {
    name = 'HideRegistrations1794923103158'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registrations" ADD "hidden_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "idx_registrations_hidden_at" ON "registrations" ("hidden_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_registrations_hidden_at"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP COLUMN "hidden_at"`);
    }

}
