# adm-maisenvios

Sistema administrativo da Mais Envios. Vários usuários preenchem os mesmos cadastros em momentos diferentes e, com tudo completo, um administrador autoriza o envio para a API da Mais Envios. Este projeto é isolado do `maisenvios`: não compartilha banco nem código e só se conecta a ele pela API.

| Parte | Stack |
|---|---|
| `backend/` | NestJS 11, TypeORM 0.3, PostgreSQL 17 |
| `frontend/` | Vue 3, Vite, Tailwind CSS 4 |

## Como rodar

Requisitos: Node 24 (`nvm use`), yarn e Docker.

```bash
docker compose up -d db
```

```bash
cd backend
cp .env.example .env
yarn install
yarn migration:run
yarn seed:admin
yarn start:dev
```

Preencha `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env` antes do `seed:admin`.

```bash
cd frontend
yarn install
yarn dev
```

Acesse http://localhost:5173. A API fica em http://localhost:3100/api.

Para subir tudo em containers, em http://localhost:8080:

```bash
docker compose --profile app up --build
```

Esse modo roda em produção, com cookie `Secure`: use HTTPS fora do `localhost`. Defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` no ambiente antes de subir os containers e crie o primeiro administrador com:

```bash
docker compose exec api node dist/database/seed-admin.js
```

## Testes

Os testes usam um Postgres real e **apagam** o banco de `TEST_DATABASE_URL`.

```bash
cd backend
yarn test
```

Se o volume do banco já existia antes do `db/init.sql`, crie o banco `adm_maisenvios_test` manualmente.

## Como adicionar uma permissão

1. Inclua em `PERMISSIONS`, em `backend/src/access/permissions.ts`.
2. Proteja a rota com `@RequirePermission(PERMISSIONS.NOME)`.
3. Se a tela precisar dela, repita em `frontend/src/auth/permissions.ts` e use `can(...)`.

Toda rota exige sessão por padrão. Só fica aberto o que tiver `@Public()`.

## Como adicionar um papel

Inclua em `ROLES`, em `backend/src/access/roles.ts`:

```ts
financeiro: {
  name: 'Financeiro',
  permissions: [PERMISSIONS.AUDIT_READ],
},
```

O papel já aparece na tela de usuários. O `admin` recebe automaticamente toda permissão nova.

## Como auditar uma entidade

Coloque `@Auditable` na entidade e altere sempre com `save()` ou `remove()`:

```ts
@Auditable({ name: 'cliente', sensitive: ['token'] })
@Entity('clientes')
export class Cliente {}
```

Cada alteração grava usuário, data, IP e valor antigo e novo de cada campo, na mesma transação. Campos em `sensitive` registram só que mudaram. `insert()`, `update()` e `delete()` são recusados nessas entidades, porque escapariam da auditoria.

Para eventos que não são alteração de dados, como uma aprovação:

```ts
await this.audit.record({ action: 'cliente.aprovado', entity: 'cliente', entityId: id }, manager);
```

Passe o `manager` da transação para gravar junto. Depois inclua o texto em `frontend/src/audit/labels.ts`.
