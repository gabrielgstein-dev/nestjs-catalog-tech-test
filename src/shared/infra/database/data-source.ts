import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';

// Used by the TypeORM CLI for migrations (no synchronize, no Nest runtime).
loadEnv();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'catalog',
  password: process.env.DB_PASSWORD ?? 'catalog',
  database: process.env.DB_NAME ?? 'catalog',
  synchronize: false,
  migrationsRun: false,
  entities: [join(__dirname, '../../../modules/**/infra/entities/*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  logging: ['error', 'warn', 'migration'],
};

export const AppDataSource = new DataSource(dataSourceOptions);
