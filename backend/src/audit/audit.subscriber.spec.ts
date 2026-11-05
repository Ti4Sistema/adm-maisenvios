import '../testing/test-env';
import { strict as assert } from 'node:assert';
import { after, before, beforeEach, test } from 'node:test';
import dataSource from '../database/data-source';
import { resetDatabase } from '../testing/reset-database';
import { User } from '../users/user.entity';
import { AuditLog } from './audit-log.entity';

const blockedMessage = /auditável/;
let sequence = 0;

function newUser() {
  sequence += 1;
  return dataSource.manager.create(User, {
    name: 'Fulano',
    email: `fulano${sequence}@teste.com`,
    passwordHash: 'hash-secreto',
  });
}

function logsOf(entityId: string) {
  return dataSource.manager.find(AuditLog, {
    where: { entity: 'user', entityId },
    order: { id: 'ASC' },
  });
}

before(async () => {
  await dataSource.initialize();
  await resetDatabase(dataSource);
});

after(() => dataSource.destroy());

beforeEach(() => {
  sequence += 1;
});

test('registra a criação sem expor campos sensíveis', async () => {
  const user = await dataSource.manager.save(newUser());
  const [log] = await logsOf(user.id);

  assert.equal(log.action, 'create');
  assert.deepEqual(log.changes?.email, { from: null, to: user.email });
  assert.deepEqual(log.changes?.passwordHash, { from: null, to: '[protegido]' });
  assert.equal(JSON.stringify(log.changes).includes('hash-secreto'), false);
});

test('registra só os campos alterados, com valor antigo e novo', async () => {
  const user = await dataSource.manager.save(newUser());
  user.name = 'Beltrano';
  await dataSource.manager.save(user);

  const [, log] = await logsOf(user.id);
  assert.equal(log.action, 'update');
  assert.deepEqual(log.changes, { name: { from: 'Fulano', to: 'Beltrano' } });
});

test('não registra nada quando salva sem mudança', async () => {
  const user = await dataSource.manager.save(newUser());
  await dataSource.manager.save(user);
  assert.equal((await logsOf(user.id)).length, 1);
});

test('registra a remoção com os valores anteriores', async () => {
  const user = await dataSource.manager.save(newUser());
  const { id, email } = user;
  await dataSource.manager.remove(user);

  const [, log] = await logsOf(id);
  assert.equal(log.action, 'delete');
  assert.deepEqual(log.changes?.email, { from: email, to: null });
});

test('desfaz a auditoria junto com a transação', async () => {
  const user = newUser();
  await assert.rejects(
    dataSource.transaction(async (manager) => {
      await manager.save(user);
      throw new Error('falha depois de salvar');
    }),
  );
  assert.equal((await logsOf(user.id)).length, 0);
});

test('bloqueia alterações que escapariam da auditoria', async () => {
  const { id } = await dataSource.manager.save(newUser());
  const repository = dataSource.getRepository(User);

  await assert.rejects(repository.insert(newUser()), blockedMessage);
  await assert.rejects(repository.update({ id }, { name: 'Oculto' }), blockedMessage);
  await assert.rejects(repository.delete({ id }), blockedMessage);
  await assert.rejects(
    dataSource.transaction((manager) => manager.update(User, { id }, { name: 'Oculto' })),
    blockedMessage,
  );

  assert.equal((await repository.findOneByOrFail({ id })).name, 'Fulano');
});

test('o banco recusa alterar ou apagar a auditoria', async () => {
  const appendOnly = /aceita apenas inserção/;
  await assert.rejects(dataSource.query(`UPDATE audit_log SET action = 'x'`), appendOnly);
  await assert.rejects(dataSource.query('DELETE FROM audit_log'), appendOnly);
  await assert.rejects(dataSource.query('TRUNCATE audit_log'), appendOnly);
});
