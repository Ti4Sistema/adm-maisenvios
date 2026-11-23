import { MigrationInterface, QueryRunner } from "typeorm";

// Duas opções novas do portal: "Etiqueta +Envios" e "Exigir CPF/CNPJ do
// destinatário nas telas". Padrão Não; os Clientes que já existem também ficam
// com Não, como os novos.
export class RecipientOptions1795102892612 implements MigrationInterface {
    name = 'RecipientOptions1795102892612'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registrations" ADD "mais_envios_label" boolean`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD "require_recipient_document" boolean`);
        await queryRunner.query(
            `UPDATE "registrations" SET "mais_envios_label" = false, "require_recipient_document" = false WHERE "type" = 'client'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registrations" DROP COLUMN "require_recipient_document"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP COLUMN "mais_envios_label"`);
    }

}
