/**
 * TransCycle — Conexión a PostgreSQL
 * Pool de conexiones con reconexión automática
 */

import { Pool, PoolClient } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : false,
});

pool.on("error", (err) => {
  console.error("[DB] Error inesperado en cliente inactivo:", err.message);
});

/**
 * Ejecuta una query con parámetros y devuelve las filas.
 */
export async function query<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

/**
 * Ejecuta múltiples queries en una transacción atómica.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verifica la conexión al arrancar el servidor.
 */
export async function checkConnection(): Promise<void> {
  const rows = await query<{ now: Date }>("SELECT NOW() as now");
  console.log(`[DB] Conectado. Hora del servidor: ${rows[0].now}`);
}
