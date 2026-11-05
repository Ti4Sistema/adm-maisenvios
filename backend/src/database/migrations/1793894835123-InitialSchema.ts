import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1793894835123 implements MigrationInterface {
    name = 'InitialSchema1793894835123'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_log" ("id" BIGSERIAL NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "action" text NOT NULL, "entity" text, "entity_id" text, "actor_id" uuid, "actor_email" text, "ip" text, "request_id" uuid, "changes" jsonb, "metadata" jsonb, CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_audit_log_actor" ON "audit_log" ("actor_id") `);
        await queryRunner.query(`CREATE INDEX "idx_audit_log_entity" ON "audit_log" ("entity", "entity_id") `);
        await queryRunner.query(`CREATE TABLE "user_roles" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "role" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_user_roles_user_role" UNIQUE ("user_id", "role"), CONSTRAINT "PK_8acd5cf26ebd158416f477de799" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "email" text NOT NULL, "password_hash" text NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_users_email" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_sessions_token_hash" UNIQUE ("token_hash"), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_sessions_user" ON "sessions" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // A auditoria só aceita inserção, inclusive para quem acessa o banco direto.
        await queryRunner.query(`
            CREATE FUNCTION audit_log_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'audit_log aceita apenas inserção';
            END;
            $$ LANGUAGE plpgsql
        `);
        await queryRunner.query(`CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON "audit_log" FOR EACH ROW EXECUTE FUNCTION audit_log_append_only()`);
        await queryRunner.query(`CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON "audit_log" FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER "audit_log_no_truncate" ON "audit_log"`);
        await queryRunner.query(`DROP TRIGGER "audit_log_no_change" ON "audit_log"`);
        await queryRunner.query(`DROP FUNCTION audit_log_append_only`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sessions_user"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "user_roles"`);
        await queryRunner.query(`DROP INDEX "public"."idx_audit_log_entity"`);
        await queryRunner.query(`DROP INDEX "public"."idx_audit_log_actor"`);
        await queryRunner.query(`DROP TABLE "audit_log"`);
    }

}
