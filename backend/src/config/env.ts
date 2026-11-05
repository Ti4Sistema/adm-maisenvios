import { existsSync } from 'node:fs';
import { join } from 'node:path';

const envFile = join(process.cwd(), '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não definida`);
  return value;
}

export const env = {
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 3100),
  databaseUrl: required('DATABASE_URL'),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 8),
};
