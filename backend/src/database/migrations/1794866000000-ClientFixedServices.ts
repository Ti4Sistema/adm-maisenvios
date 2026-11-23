import { MigrationInterface, QueryRunner } from "typeorm";

// Os clientes já cadastrados passam a ter os serviços fixos do Cliente, mantendo
// spread, malha e os serviços extras que já tinham. Não muda o schema.
const CLIENT_SERVICE_CODES = ['03298', '03220', '03158', '03140', '04227', '03301', '03247', '03182', '03174'];

interface ServiceItem {
    code: string;
    spread: number | null;
    malha: number | null;
}

export class ClientFixedServices1794866000000 implements MigrationInterface {
    name = 'ClientFixedServices1794866000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const rows: { id: string; services: ServiceItem[] | null }[] = await queryRunner.query(
            `SELECT "id", "services" FROM "registrations" WHERE "type" = 'client'`,
        );
        for (const { id, services } of rows) {
            const items = services ?? [];
            const byCode = new Map(items.map((item) => [item.code, item]));
            const merged = [
                ...CLIENT_SERVICE_CODES.map((code) => byCode.get(code) ?? { code, spread: null, malha: null }),
                ...items.filter((item) => !CLIENT_SERVICE_CODES.includes(item.code)),
            ];
            await queryRunner.query(`UPDATE "registrations" SET "services" = $1 WHERE "id" = $2`, [
                JSON.stringify(merged),
                id,
            ]);
        }
    }

    public async down(): Promise<void> {
        // Os serviços antigos de cada cliente não são guardados; nada a desfazer.
    }

}
