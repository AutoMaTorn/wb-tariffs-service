import type { Knex } from 'knex';

export const config: Knex.Config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'db',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  migrations: {
    directory: './src/migrations',
    extension: 'ts'
  }
};