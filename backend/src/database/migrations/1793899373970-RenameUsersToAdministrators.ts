import { MigrationInterface, QueryRunner } from "typeorm";

// Só renomeia, sem apagar dados. Os registros antigos de audit_log continuam com
// entity 'user' e 'user_role', porque a auditoria não pode ser alterada.
export class RenameUsersToAdministrators1793899373970 implements MigrationInterface {
    name = 'RenameUsersToAdministrators1793899373970'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME TO "administrators"`);
        await queryRunner.query(`ALTER TABLE "user_roles" RENAME TO "administrator_roles"`);
        await queryRunner.query(`ALTER TABLE "administrator_roles" RENAME COLUMN "user_id" TO "administrator_id"`);
        await queryRunner.query(`ALTER TABLE "sessions" RENAME COLUMN "user_id" TO "administrator_id"`);
        await queryRunner.query(`ALTER TABLE "administrators" RENAME CONSTRAINT "uq_users_email" TO "uq_administrators_email"`);
        await queryRunner.query(`ALTER TABLE "administrators" RENAME CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" TO "PK_aaa48522d99c3b6b33fdea7dc2f"`);
        await queryRunner.query(`ALTER TABLE "administrator_roles" RENAME CONSTRAINT "uq_user_roles_user_role" TO "uq_administrator_roles_administrator_role"`);
        await queryRunner.query(`ALTER TABLE "administrator_roles" RENAME CONSTRAINT "PK_8acd5cf26ebd158416f477de799" TO "PK_4497bcab87fa7f5c98ccccfa08f"`);
        await queryRunner.query(`ALTER TABLE "administrator_roles" RENAME CONSTRAINT "FK_87b8888186ca9769c960e926870" TO "FK_fcfa5671428bc8d5b0fc31377a8"`);
        await queryRunner.query(`ALTER TABLE "sessions" RENAME CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" TO "FK_6e9068957500d8c8055f4f05c8e"`);
        await queryRunner.query(`ALTER INDEX "idx_sessions_user" RENAME TO "idx_sessions_administrator"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER INDEX "idx_sessions_administrator" RENAME TO "idx_sessions_user"`);
        await queryRunner.query(`ALTER TABLE "sessions" RENAME CONSTRAINT "FK_6e9068957500d8c8055f4f05c8e" TO "FK_085d540d9f418cfbdc7bd55bb19"`);
        await queryRunner.query(`ALTER TABLE "administrator_roles" RENAME CONSTRAINT "FK_fcfa5671428bc8d5b0fc31377a8" TO "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`ALTER TABLE "administrator_roles" RENAME CONSTRAINT "PK_4497bcab87fa7f5c98ccccfa08f" TO "PK_8acd5cf26ebd158416f477de799"`);
        await queryRunner.query(`ALTER TABLE "administrator_roles" RENAME CONSTRAINT "uq_administrator_roles_administrator_role" TO "uq_user_roles_user_role"`);
        await queryRunner.query(`ALTER TABLE "administrators" RENAME CONSTRAINT "PK_aaa48522d99c3b6b33fdea7dc2f" TO "PK_a3ffb1c0c8416b9fc6f907b7433"`);
        await queryRunner.query(`ALTER TABLE "administrators" RENAME CONSTRAINT "uq_administrators_email" TO "uq_users_email"`);
        await queryRunner.query(`ALTER TABLE "sessions" RENAME COLUMN "administrator_id" TO "user_id"`);
        await queryRunner.query(`ALTER TABLE "administrator_roles" RENAME COLUMN "administrator_id" TO "user_id"`);
        await queryRunner.query(`ALTER TABLE "administrator_roles" RENAME TO "user_roles"`);
        await queryRunner.query(`ALTER TABLE "administrators" RENAME TO "users"`);
    }

}
