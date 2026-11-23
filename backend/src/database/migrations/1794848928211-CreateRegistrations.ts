import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRegistrations1794848928211 implements MigrationInterface {
    name = 'CreateRegistrations1794848928211'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "registrations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "type" text NOT NULL, "status" text NOT NULL DEFAULT 'draft', "trade_name" text, "legal_name" text, "document" text, "customer_type" text, "master_license" text, "billing_type" text, "billing_email" text, "due_days" integer, "beneficiary" text, "main_zip" text, "main_number" text, "main_complement" text, "main_street" text, "main_district" text, "main_city" text, "main_state" text, "main_address_name" text, "pickup_zip" text, "pickup_number" text, "pickup_complement" text, "pickup_street" text, "pickup_district" text, "pickup_city" text, "pickup_state" text, "pickup_address_name" text, "package_table" text, "reverse_table" text, "postage_contract" text, "postage_card" text, "billing_document" text, "credit_limit" integer, "insurance" numeric(5,2), "reverse_validity_days" integer, "skip_postage_cost" boolean, "logical_labels" boolean, "separate_branch_invoice" boolean, "services" jsonb, "state_registration" text, "municipal_registration" text, "whatsapp_notifications" boolean, "unified_label" boolean, "force_dce" boolean, "contact_name" text, "mobile_phone" text, "business_phone" text, "home_phone" text, "website" text, "uses_malha" boolean, "malha_all_units" boolean, "malha_discount" numeric(5,2), "declaration_content" text, "declaration_quantity" integer, "declaration_value" integer, "admin_login" text, "pdv_login" text, "notes" text, "approved_at" TIMESTAMP WITH TIME ZONE, "approved_by_id" uuid, "created_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_registrations_status" CHECK (status IN ('draft', 'ready', 'approved')), CONSTRAINT "chk_registrations_type" CHECK (type IN ('client', 'smart')), CONSTRAINT "PK_6013e724d7b22929da9cd7282d1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_registrations_status" ON "registrations" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_registrations_document" ON "registrations" ("document") `);
        await queryRunner.query(`ALTER TABLE "registrations" ADD CONSTRAINT "FK_76f9697f0f8f9a226d5c79e9ce6" FOREIGN KEY ("approved_by_id") REFERENCES "administrators"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD CONSTRAINT "FK_290e1ee6ac7121712cd847464a1" FOREIGN KEY ("created_by_id") REFERENCES "administrators"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registrations" DROP CONSTRAINT "FK_290e1ee6ac7121712cd847464a1"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP CONSTRAINT "FK_76f9697f0f8f9a226d5c79e9ce6"`);
        await queryRunner.query(`DROP INDEX "public"."idx_registrations_document"`);
        await queryRunner.query(`DROP INDEX "public"."idx_registrations_status"`);
        await queryRunner.query(`DROP TABLE "registrations"`);
    }

}
