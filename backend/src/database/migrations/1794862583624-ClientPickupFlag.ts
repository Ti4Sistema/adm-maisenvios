import { MigrationInterface, QueryRunner } from "typeorm";

// Tira o campo "Identificação" dos endereços e cria o Sim/Não "Endereço de coleta".
// Nos clientes já existentes, liga a coleta onde ela já tinha CEP e aplica os
// novos padrões dos Sim/Não que estavam vazios.
export class ClientPickupFlag1794862583624 implements MigrationInterface {
    name = 'ClientPickupFlag1794862583624'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registrations" DROP COLUMN "main_address_name"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP COLUMN "pickup_address_name"`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD "has_pickup_address" boolean`);
        await queryRunner.query(`
            UPDATE "registrations" SET
                "has_pickup_address" = ("pickup_zip" IS NOT NULL),
                "logical_labels" = COALESCE("logical_labels", false),
                "separate_branch_invoice" = COALESCE("separate_branch_invoice", false),
                "whatsapp_notifications" = COALESCE("whatsapp_notifications", true),
                "unified_label" = COALESCE("unified_label", true),
                "force_dce" = COALESCE("force_dce", false)
            WHERE "type" = 'client'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registrations" DROP COLUMN "has_pickup_address"`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD "pickup_address_name" text`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD "main_address_name" text`);
    }

}
