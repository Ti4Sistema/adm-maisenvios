import { DataSource } from 'typeorm';

export async function resetDatabase(dataSource: DataSource) {
  await dataSource.query('DROP SCHEMA public CASCADE');
  await dataSource.query('CREATE SCHEMA public');
  await dataSource.runMigrations();
}
