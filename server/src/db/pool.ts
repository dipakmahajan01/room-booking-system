import pg from 'pg';
import { config } from '../config';

/**
 * One shared pool of reusable PostgreSQL connections.
 * pool.query() borrows a connection, runs the query and returns it.
 */
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
});
