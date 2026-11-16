import '../testing/test-env';
import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { AdministratorRole } from '../access/administrator-role.entity';
import { Administrator } from '../administrators/administrator.entity';
import { AppModule } from '../app.module';
import { AuditLog } from '../audit/audit-log.entity';
import { hashPassword } from '../auth/password';
import { configureApp } from '../main';
import { resetDatabase } from '../testing/reset-database';

const CNPJ = '11222333000181';

interface View {
  id: string;
  status: string;
  values: Record<string, unknown>;
  suggested: Record<string, unknown>;
  missing: string[];
  warnings: { field: string; message: string }[];
}

let app: NestExpressApplication;
let dataSource: DataSource;
let baseUrl: string;
const sessions: Record<string, string> = {};

function send(method: string, path: string, cookie: string, body?: unknown) {
  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json<T = View>(response: Response, status = 200): Promise<T> {
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  return body as T;
}

async function createWithRole(role: string) {
  const email = `${role}@teste.com`;
  const password = `senha-do-${role}`;
  await dataSource.transaction(async (manager) => {
    const administrator = await manager.save(
      manager.create(Administrator, { name: role, email, passwordHash: await hashPassword(password) }),
    );
    await manager.save(manager.create(AdministratorRole, { administratorId: administrator.id, role }));
  });
  const response = await send('POST', '/auth/login', '', { email, password });
  sessions[role] = response.headers.getSetCookie()[0].split(';')[0];
}

const smartValues = {
  tradeName: 'PDV SMART MAIS ENVIOS 005 GUI',
  legalName: 'GUI COMERCIO LTDA',
  document: '11.222.333/0001-81',
  masterLicense: 'MAIS ENVIOS 005',
  billingEmail: 'gui@teste.com',
  mainZip: '01310-100',
  mainNumber: '498',
};

before(async () => {
  app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0);
  baseUrl = await app.getUrl();
  dataSource = app.get(DataSource);
  await resetDatabase(dataSource);
  for (const role of ['admin', 'editor', 'reader']) await createWithRole(role);
});

after(() => app.close());

test('o editor preenche por partes e a linha fica pronta sozinha', async () => {
  const created = await json(await send('POST', '/registrations', sessions.editor, { type: 'smart' }), 201);
  assert.equal(created.status, 'draft');
  assert.equal(created.values.billingType, 'Faturamento Mensal');
  assert.ok(created.missing.includes('tradeName'));

  const { tradeName, legalName, ...rest } = smartValues;
  let view = await json(
    await send('PATCH', `/registrations/${created.id}`, sessions.editor, {
      changes: [
        { field: 'tradeName', from: null, to: tradeName },
        { field: 'legalName', from: null, to: legalName },
      ],
    }),
  );
  assert.equal(view.suggested.adminLogin, 'admpdvsmartgui');
  assert.equal(view.status, 'draft');

  view = await json(
    await send('PATCH', `/registrations/${created.id}`, sessions.editor, {
      changes: Object.entries(rest).map(([field, to]) => ({ field, from: null, to })),
    }),
  );
  assert.equal(view.values.document, CNPJ);
  assert.deepEqual(view.missing, []);
  assert.equal(view.status, 'ready');
});

test('edição simultânea do mesmo campo é conflito; de campos diferentes, não', async () => {
  const { id } = await json(await send('POST', '/registrations', sessions.editor, { type: 'client' }), 201);
  const first = { field: 'tradeName', from: null, to: 'LOJA A' };
  await json(await send('PATCH', `/registrations/${id}`, sessions.editor, { changes: [first] }));

  const other = await send('PATCH', `/registrations/${id}`, sessions.admin, {
    changes: [{ field: 'legalName', from: null, to: 'LOJA A LTDA' }],
  });
  assert.equal(other.status, 200);

  const stale = await send('PATCH', `/registrations/${id}`, sessions.admin, {
    changes: [{ field: 'tradeName', from: null, to: 'LOJA B' }],
  });
  const body = await json<{ conflicts: { field: string; current: string }[] }>(stale, 409);
  assert.deepEqual(body.conflicts, [{ field: 'tradeName', current: 'LOJA A' }]);
});

test('campos fixos, desconhecidos e valores inválidos são recusados', async () => {
  const { id } = await json(await send('POST', '/registrations', sessions.editor, { type: 'smart' }), 201);
  for (const change of [
    { field: 'insurance', from: null, to: '5' },
    { field: 'beneficiary', from: null, to: 'X' },
    { field: 'inexistente', from: null, to: 'X' },
    { field: 'billingType', from: 'Faturamento Mensal', to: 'anual' },
  ]) {
    const response = await send('PATCH', `/registrations/${id}`, sessions.editor, { changes: [change] });
    assert.equal(response.status, 400, change.field);
  }
});

test('leitura só consulta; só o admin aprova e edita depois de aprovado', async () => {
  assert.equal((await send('GET', '/registrations', sessions.reader)).status, 200);
  assert.equal((await send('GET', '/registrations/schema', sessions.reader)).status, 200);
  assert.equal((await send('POST', '/registrations', sessions.reader, { type: 'smart' })).status, 403);

  const { id } = await json(
    await send('POST', '/registrations', sessions.editor, { type: 'smart', values: smartValues }),
    201,
  );
  assert.equal((await send('POST', `/registrations/${id}/approve`, sessions.editor)).status, 403);

  const approved = await json(await send('POST', `/registrations/${id}/approve`, sessions.admin));
  assert.equal(approved.status, 'approved');

  const change = { changes: [{ field: 'contactName', from: null, to: 'Gui' }] };
  assert.equal((await send('PATCH', `/registrations/${id}`, sessions.editor, change)).status, 403);
  assert.equal((await send('DELETE', `/registrations/${id}`, sessions.editor)).status, 403);
  assert.equal((await json(await send('PATCH', `/registrations/${id}`, sessions.admin, change))).status, 'approved');

  // Se o admin deixa a linha incompleta, ela volta a Rascunho.
  const cleared = await json(
    await send('PATCH', `/registrations/${id}`, sessions.admin, {
      changes: [{ field: 'mainNumber', from: '498', to: '' }],
    }),
  );
  assert.equal(cleared.status, 'draft');
  assert.equal((await send('POST', `/registrations/${id}/approve`, sessions.admin)).status, 409);
});

test('toda alteração entra no histórico com quem fez', async () => {
  const { id } = await json(await send('POST', '/registrations', sessions.editor, { type: 'client' }), 201);
  await send('PATCH', `/registrations/${id}`, sessions.editor, {
    changes: [{ field: 'tradeName', from: null, to: 'HISTORICO' }],
  });
  const history = await json<{ action: string; actorEmail: string; changes: AuditLog['changes'] }[]>(
    await send('GET', `/registrations/${id}/history`, sessions.reader),
  );
  assert.equal(history[0].action, 'update');
  assert.equal(history[0].actorEmail, 'editor@teste.com');
  assert.deepEqual(history[0].changes?.tradeName, { from: null, to: 'HISTORICO' });
});

test('colar linhas da planilha Smart mostra a prévia e depois cria', async () => {
  const cells = Array<string>(26).fill('');
  cells[1] = 'MAIS ENVIOS 005';
  cells[2] = 'PDV SMART COLADO';
  cells[4] = 'COLADO LTDA';
  cells[5] = '11.222.333/0001-81';
  cells[17] = 'RUA PAULISTA 498 CASA DOS FUNDOS';
  cells[21] = '01310-100';
  cells[23] = 'colado@teste.com';
  const header = Array<string>(26).fill('');
  header[2] = 'Nome Fantasia';
  const rows = [
    { line: 1, cells: header },
    { line: 2, cells },
  ];

  type Result = { created: number; items: { skipped?: string; status?: string; warnings: string[] }[] };
  const preview = await json<Result>(
    await send('POST', '/registrations/import/smart', sessions.editor, { rows, dryRun: true }),
  );
  assert.equal(preview.created, 0);
  assert.ok(preview.items[0].skipped);
  assert.equal(preview.items[1].status, 'ready');
  assert.ok(preview.items[1].warnings.some((warning) => warning.includes('Já existe')));

  const before = await dataSource.manager.count('registrations');
  const result = await json<Result>(
    await send('POST', '/registrations/import/smart', sessions.editor, { rows, dryRun: false }),
  );
  assert.equal(result.created, 1);
  assert.equal(await dataSource.manager.count('registrations'), before + 1);

  const list = await json<View[]>(await send('GET', '/registrations?search=colado', sessions.reader));
  assert.equal(list[0].values.mainComplement, 'CASA DOS FUNDOS');
  assert.ok(list[0].warnings.some(({ field }) => field === 'document'));
});
