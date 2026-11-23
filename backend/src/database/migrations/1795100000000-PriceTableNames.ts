import { MigrationInterface, QueryRunner } from "typeorm";

// Tabela Pacote e Tabela Pacote Reversa do Cliente passaram a ser escolhidas numa
// lista fixa (TABELA MAIS ENVIOS 1 a 16). O que foi digitado antes com outra
// grafia (ex.: "tabela mais envios 13") passa a usar o nome exato da lista.
// Não muda o schema.
export class PriceTableNames1795100000000 implements MigrationInterface {
    name = 'PriceTableNames1795100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const column of ['package_table', 'reverse_table']) {
            await queryRunner.query(`
                UPDATE "registrations"
                   SET "${column}" = 'TABELA MAIS ENVIOS ' || substring(upper(trim("${column}")) FROM '([0-9]+)$')
                 WHERE "type" = 'client'
                   AND upper(regexp_replace(trim("${column}"), '\\s+', ' ', 'g')) ~ '^TABELA MAIS ENVIOS ([1-9]|1[0-6])$'
            `);
        }
    }

    public async down(): Promise<void> {
        // A grafia antiga não é guardada; o nome da lista vale nos dois sentidos.
    }
}
