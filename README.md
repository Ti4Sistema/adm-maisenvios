# adm-maisenvios

Sistema administrativo da Mais Envios. Vários administradores preenchem os mesmos cadastros em momentos diferentes e, com tudo completo, um administrador autoriza o envio para a API da Mais Envios. Este projeto é isolado do `maisenvios`: não compartilha banco nem código e só se conecta a ele pela API.

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

No Windows, depois da instalação, `iniciar-sistema.bat` liga a API e a tela em duas janelas e abre o navegador (fechar as janelas desliga). Ele usa `npm run`, para funcionar mesmo quando o `yarn` não está no PATH de quem abre pelo Explorer.

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

## Pré-cadastro de clientes

As telas **Pré-cadastros › Clientes** (`/pre-cadastros/clientes`) e **Pré-cadastros › Smart** (`/pre-cadastros/smart`) são grades estilo Excel onde a equipe preenche aos poucos cada tipo de cadastro. O plano completo e as decisões estão em `docs/plano-pre-cadastro.md`.

- Os campos e as regras de cada tipo (obrigatório, fixo, calculado, escolhido no envio) ficam só em `backend/src/registrations/registration-rules.ts`. O frontend monta a grade a partir de `GET /api/registrations/schema`.
- A situação é calculada: *Rascunho* enquanto falta algo, *Pronto* quando tudo que é obrigatório está válido. Só o Admin global aprova e edita depois de aprovado.
- Cada edição envia o valor anterior do campo: se outra pessoa mudou o mesmo campo nesse meio-tempo, a API responde 409 e a tela recarrega a linha.
- Linhas inteiras copiadas da planilha Smart (colunas A a Z) viram pré-cadastros pelo botão **Colar da planilha** ou com Ctrl+V na grade da página Smart. O mapa de colunas está em `backend/src/registrations/smart-import.ts`.
- Papéis: **Admin global** (`admin`), **Editor** (`editor`) e **Leitura** (`reader`).

Para incluir um campo: acrescente em `FIELDS`, crie a coluna na entidade `Registration`, gere a migration e inclua o texto em `frontend/src/audit/labels.ts`.

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

O papel já aparece na tela de administradores. O `admin` recebe automaticamente toda permissão nova.

## Como auditar uma entidade

Coloque `@Auditable` na entidade e altere sempre com `save()` ou `remove()`:

```ts
@Auditable({ name: 'cliente', sensitive: ['token'] })
@Entity('clientes')
export class Cliente {}
```

Cada alteração grava administrador, data, IP e valor antigo e novo de cada campo, na mesma transação. Campos em `sensitive` registram só que mudaram. `insert()`, `update()` e `delete()` são recusados nessas entidades, porque escapariam da auditoria.

Para eventos que não são alteração de dados, como uma aprovação:

```ts
await this.audit.record({ action: 'cliente.aprovado', entity: 'cliente', entityId: id }, manager);
```

Passe o `manager` da transação para gravar junto. Depois inclua o texto em `frontend/src/audit/labels.ts`.
