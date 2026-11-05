import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AuditSubscriber } from '../audit/audit.subscriber';
import { env } from '../config/env';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: env.databaseUrl,
  uuidExtension: 'pgcrypto',
  installExtensions: false,
  entities: [join(__dirname, '..', '**', '*.entity.js')],
  migrations: [join(__dirname, 'migrations', '*.js')],
  subscribers: [AuditSubscriber],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
