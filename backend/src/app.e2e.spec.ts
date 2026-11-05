import './testing/test-env';
import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { PERMISSIONS } from './access/permissions';
import { ROLES } from './access/roles';
import { UserRole } from './access/user-role.entity';
import { AppModule } from './app.module';
import { AuditLog } from './audit/audit-log.entity';
import { hashPassword } from './auth/password';
import { configureApp } from './main';
import { resetDatabase } from './testing/reset-database';
import { User } from './users/user.entity';

const ADMIN = { email: 'admin@teste.com', password: 'senha-do-admin' };
const OPERATOR = { email: 'operador@teste.com', password: 'senha-do-operador' };

let app: NestExpressApplication;
let dataSource: DataSource;
let baseUrl: string;
let admin: string;

function call(path: string, cookie?: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
  });
}

function send(method: string, path: string, cookie: string | undefined, body?: unknown) {
  return call(path, cookie, { method, body: JSON.stringify(body) });
}

async function login(credentials: { email: string; password: string }) {
  const response = await send('POST', '/auth/login', undefined, credentials);
  assert.equal(response.status, 200);
  return response.headers.getSetCookie()[0].split(';')[0];
}

function lastLog(action: string) {
  return dataSource.manager.findOne(AuditLog, { where: { action }, order: { id: 'DESC' } });
}

async function createUser(body: object) {
  const response = await send('POST', '/users', admin, body);
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string };
}

before(async () => {
  app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0);
  baseUrl = await app.getUrl();
  dataSource = app.get(DataSource);
  await resetDatabase(dataSource);

  const user = await dataSource.manager.save(
    dataSource.manager.create(User, {
      name: 'Admin',
      email: ADMIN.email,
      passwordHash: await hashPassword(ADMIN.password),
    }),
  );
  await dataSource.manager.save(
    dataSource.manager.create(UserRole, { userId: user.id, role: 'admin' }),
  );
  admin = await login(ADMIN);
});

after(() => app.close());

test('a saúde responde sem sessão e o restante exige sessão', async () => {
  assert.equal((await call('/health')).status, 200);
  assert.equal((await call('/users')).status, 401);
  assert.equal((await call('/users', 'adm_session=token-falso')).status, 401);
});

test('login inválido é recusado e auditado', async () => {
  const response = await send('POST', '/auth/login', undefined, {
    email: ADMIN.email,
    password: 'senha-errada',
  });
  assert.equal(response.status, 401);
  assert.equal((await lastLog('auth.login_failed'))?.metadata?.email, ADMIN.email);
});

test('o login grava cookie protegido e nunca o token em texto puro', async () => {
  const response = await send('POST', '/auth/login', undefined, ADMIN);
  const header = response.headers.getSetCookie()[0];
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Strict/);

  const token = header.split(';')[0].split('=')[1];
  const [{ count }] = await dataSource.query(
    'SELECT count(*)::int AS count FROM sessions WHERE token_hash = $1',
    [token],
  );
  assert.equal(count, 0);
});

test('o usuário só acessa o que seus papéis permitem, e a negação é auditada', async () => {
  await createUser({ name: 'Operador', ...OPERATOR, roles: [] });
  const operator = await login(OPERATOR);

  const me = (await (await call('/auth/me', operator)).json()) as { permissions: string[] };
  assert.deepEqual(me.permissions, []);

  assert.equal((await call('/audit', operator)).status, 403);
  const denied = await lastLog('access.denied');
  assert.equal(denied?.actorEmail, OPERATOR.email);
  assert.deepEqual(denied?.metadata?.required, [PERMISSIONS.AUDIT_READ]);
});

test('a resposta de usuários nunca traz a senha', async () => {
  const body = await (await call('/users', admin)).text();
  assert.equal(body.includes('password'), false);
});

test('a alteração feita pela API registra quem fez, o IP e os valores', async () => {
  const user = await createUser({
    name: 'Antigo',
    email: 'auditado@teste.com',
    password: 'senha-inicial',
    roles: [],
  });
  await send('PATCH', `/users/${user.id}`, admin, { name: 'Novo' });

  const response = await call(`/audit?entity=user&entityId=${user.id}&action=update`, admin);
  const { items, total } = (await response.json()) as { items: AuditLog[]; total: number };
  assert.equal(total, 1);
  assert.equal(items[0].actorEmail, ADMIN.email);
  assert.ok(items[0].ip);
  assert.deepEqual(items[0].changes, { name: { from: 'Antigo', to: 'Novo' } });
});

test('atribuir papel é auditado e vale na próxima requisição', async () => {
  ROLES.leitor = { name: 'Leitor', permissions: [PERMISSIONS.AUDIT_READ] };
  const credentials = { email: 'leitor@teste.com', password: 'senha-do-leitor' };
  const user = await createUser({ name: 'Leitor', ...credentials, roles: [] });
  const session = await login(credentials);
  assert.equal((await call('/audit', session)).status, 403);

  await dataSource.transaction((manager) =>
    manager.save(manager.create(UserRole, { userId: user.id, role: 'leitor' })),
  );
  assert.equal((await call('/audit', session)).status, 200);
  assert.deepEqual((await lastLog('create'))?.changes?.role, { from: null, to: 'leitor' });
});

test('quem gerencia usuários não concede nem edita acesso acima do seu', async () => {
  ROLES.gestor = { name: 'Gestor', permissions: [PERMISSIONS.USERS_MANAGE] };
  const credentials = { email: 'gestor@teste.com', password: 'senha-do-gestor' };
  const user = await createUser({ name: 'Gestor', ...credentials, roles: [] });
  await dataSource.transaction((manager) =>
    manager.save(manager.create(UserRole, { userId: user.id, role: 'gestor' })),
  );
  const manager = await login(credentials);

  const promote = await send('PATCH', `/users/${user.id}`, manager, { roles: ['admin'] });
  assert.equal(promote.status, 403);

  const { id: adminId } = await dataSource.manager.findOneByOrFail(User, { email: ADMIN.email });
  const takeover = await send('PATCH', `/users/${adminId}`, manager, {
    password: 'senha-roubada-1',
  });
  assert.equal(takeover.status, 403);
});

test('desativar usuário encerra o acesso na hora', async () => {
  const credentials = { email: 'saindo@teste.com', password: 'senha-de-quem-sai' };
  const user = await createUser({ name: 'Saindo', ...credentials, roles: [] });
  const session = await login(credentials);
  assert.equal((await call('/auth/me', session)).status, 200);

  await send('PATCH', `/users/${user.id}`, admin, { active: false });
  assert.equal((await call('/auth/me', session)).status, 401);
  const response = await send('POST', '/auth/login', undefined, credentials);
  assert.equal(response.status, 401);
});

test('o sistema nunca fica sem administrador ativo', async () => {
  const { id } = await dataSource.manager.findOneByOrFail(User, { email: ADMIN.email });
  assert.equal((await send('PATCH', `/users/${id}`, admin, { active: false })).status, 409);
  assert.equal((await send('PATCH', `/users/${id}`, admin, { roles: [] })).status, 409);
});

test('trocar a senha encerra as outras sessões e mantém a atual', async () => {
  const credentials = { email: 'troca@teste.com', password: 'senha-antiga-1' };
  await createUser({ name: 'Troca', ...credentials, roles: [] });
  const current = await login(credentials);
  const other = await login(credentials);

  const wrong = await send('POST', '/auth/change-password', current, {
    currentPassword: 'incorreta',
    newPassword: 'senha-nova-123',
  });
  assert.equal(wrong.status, 400);

  const changed = await send('POST', '/auth/change-password', current, {
    currentPassword: credentials.password,
    newPassword: 'senha-nova-123',
  });
  assert.equal(changed.status, 204);
  assert.equal((await call('/auth/me', current)).status, 200);
  assert.equal((await call('/auth/me', other)).status, 401);
  assert.equal(JSON.stringify((await lastLog('update'))?.changes).includes('protegido'), true);
});

test('sair invalida a sessão', async () => {
  const session = await login(ADMIN);
  assert.equal((await send('POST', '/auth/logout', session)).status, 204);
  assert.equal((await call('/auth/me', session)).status, 401);
  assert.equal((await lastLog('auth.logout'))?.actorEmail, ADMIN.email);
});

test('dados inválidos e campos desconhecidos são recusados', async () => {
  const short = await send('POST', '/users', admin, {
    name: 'X',
    email: 'x@teste.com',
    password: 'curta',
    roles: [],
  });
  assert.equal(short.status, 400);

  const unknownRole = await send('POST', '/users', admin, {
    name: 'X',
    email: 'x@teste.com',
    password: 'senha-valida-1',
    roles: ['inexistente'],
  });
  assert.equal(unknownRole.status, 400);

  const extraField = await send('PATCH', '/users/00000000-0000-4000-8000-000000000000', admin, {
    isAdmin: true,
  });
  assert.equal(extraField.status, 400);
});
