import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const COST = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 32;
const MAX_MEMORY = 256 * 1024 * 1024;

function derive(
  password: string,
  salt: Buffer,
  cost: typeof COST,
  length = KEY_LENGTH,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, { ...cost, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST);
  const { N, r, p } = COST;
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | undefined) {
  if (!stored) {
    // Mesmo custo de uma senha real, para o tempo de resposta não revelar se o e-mail existe.
    await derive(password, randomBytes(16), COST);
    return false;
  }

  const [, N, r, p, salt, key] = stored.split('$');
  const expected = Buffer.from(key, 'base64');
  const cost = { N: Number(N), r: Number(r), p: Number(p) };
  const actual = await derive(password, Buffer.from(salt, 'base64'), cost, expected.length);
  return timingSafeEqual(actual, expected);
}
