import { MigrationInterface, QueryRunner } from "typeorm";

// Os campos da malha do Cliente passaram a ser fixos (Todas as unidades = Sim,
// desconto 0, declaração Documentos / 1 / R$ 100,00), assim como o spread dos
// serviços padrão deixou de existir. Limpa o que tinha sido digitado antes,
// para o banco não guardar valores que a regra ignora. Não muda o schema.
const NO_SPREAD_CODES = ['03298', '03220', '04227', '03158', '03140', '03301', '03247', '03182', '03174'];

export class FixedMalhaValues1794930000000 implements MigrationInterface {
    name = 'FixedMalhaValues1794930000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "registrations"
               SET "malha_all_units" = NULL, "malha_discount" = NULL, "declaration_content" = NULL,
                   "declaration_quantity" = NULL, "declaration_value" = NULL
             WHERE "type" = 'client'
        `);
        await queryRunner.query(
            `UPDATE "registrations"
                SET "services" = (
                    SELECT jsonb_agg(CASE WHEN item->>'code' = ANY($1) THEN jsonb_set(item, '{spread}', 'null') ELSE item END
                                     ORDER BY position)
                      FROM jsonb_array_elements("services") WITH ORDINALITY AS list(item, position)
                )
              WHERE jsonb_typeof("services") = 'array' AND jsonb_array_length("services") > 0`,
            [NO_SPREAD_CODES],
        );
    }

    public async down(): Promise<void> {
        // Os valores apagados não voltam: a regra atual não usa nenhum deles.
    }
}
