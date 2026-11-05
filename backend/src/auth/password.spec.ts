import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from './password';

test('aceita a senha correta e recusa a errada', async () => {
  const hash = await hashPassword('senha-de-teste');
  assert.equal(await verifyPassword('senha-de-teste', hash), true);
  assert.equal(await verifyPassword('senha-errada', hash), false);
});

test('gera hash diferente para a mesma senha', async () => {
  assert.notEqual(await hashPassword('mesma-senha'), await hashPassword('mesma-senha'));
});

test('recusa quando o usuário não existe', async () => {
  assert.equal(await verifyPassword('qualquer', undefined), false);
});
