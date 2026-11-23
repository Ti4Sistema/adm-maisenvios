import { MigrationInterface, QueryRunner } from "typeorm";

// Pré-cadastros que já existiam: corta o Nome Fantasia em 30 caracteres e
// preenche os logins vazios com a sugestão (Cliente: "<1ª palavra>admin";
// Smart: "admpdvsmart<última palavra>" e "pdvsmart<última palavra>").
// A lógica fica copiada aqui de propósito: a migration não muda se a regra mudar.
const MAX_NAME = 30;

function loginWords(name: string) {
    return name
        .split(/\s+/)
        .map((word) => word.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter(Boolean);
}

export class TrimNamesAndFillLogins1794867000000 implements MigrationInterface {
    name = 'TrimNamesAndFillLogins1794867000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const rows: {
            id: string;
            type: string;
            trade_name: string | null;
            admin_login: string | null;
            pdv_login: string | null;
        }[] = await queryRunner.query(
            `SELECT "id", "type", "trade_name", "admin_login", "pdv_login" FROM "registrations"`,
        );
        for (const row of rows) {
            const name = row.trade_name ? row.trade_name.slice(0, MAX_NAME).trimEnd() : null;
            const words = name ? loginWords(name) : [];
            const first = words[0];
            const last = words[words.length - 1];
            const adminLogin =
                row.admin_login || (first ? (row.type === 'smart' ? `admpdvsmart${last}` : `${first}admin`) : null);
            const pdvLogin = row.pdv_login || (row.type === 'smart' && last ? `pdvsmart${last}` : null);
            if (name === row.trade_name && adminLogin === row.admin_login && pdvLogin === row.pdv_login) continue;
            await queryRunner.query(
                `UPDATE "registrations" SET "trade_name" = $1, "admin_login" = $2, "pdv_login" = $3 WHERE "id" = $4`,
                [name, adminLogin, pdvLogin, row.id],
            );
        }
    }

    public async down(): Promise<void> {
        // Os nomes cortados e os logins vazios anteriores não são guardados.
    }

}
