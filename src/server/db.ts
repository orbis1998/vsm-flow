import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadDotEnv() {
  try {
    const full = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(full)) return;
    for (const raw of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      if (process.env[key]) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // fs indisponible côté bundler
  }
}

function poolConfig(): pg.PoolConfig {
  loadDotEnv();
  const url = process.env.DATABASE_URL;
  let password = process.env.PGPASSWORD;
  if (!password && url) {
    try {
      password = decodeURIComponent(new URL(url).password);
    } catch {
      password = undefined;
    }
  }
  const envUser = process.env.PGUSER;
  const user =
    envUser && envUser.includes(".") ? envUser : "postgres.mkksxwbchrfftsdyzmeq";
  return {
    host: process.env.PGHOST ?? "aws-1-eu-west-1.pooler.supabase.com",
    port: Number(process.env.PGPORT ?? 6543),
    user,
    password,
    database: process.env.PGDATABASE ?? "postgres",
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 8_000,
    connectionTimeoutMillis: 12_000,
    allowExitOnIdle: true,
  };
}

const globalForDb = globalThis as { __vsmPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!globalForDb.__vsmPool) {
    const p = new pg.Pool(poolConfig());
    p.on("error", () => undefined);
    globalForDb.__vsmPool = p;
  }
  return globalForDb.__vsmPool;
}

async function grabClient(): Promise<pg.PoolClient> {
  let last: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const client = await pool().connect();
      client.on("error", () => undefined);
      return client;
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}

/** Lecture : pas de BEGIN (pooler transaction). */
export async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await grabClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Écritures atomiques. */
export async function withTxn<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await grabClient();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }
}
