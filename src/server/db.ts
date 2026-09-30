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

function parseDatabaseUrl(url: string | undefined) {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : undefined,
      user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      database: parsed.pathname.replace(/^\//, "") || undefined,
    };
  } catch {
    return {};
  }
}

function poolConfig(): pg.PoolConfig {
  loadDotEnv();
  const fromUrl = parseDatabaseUrl(process.env.DATABASE_URL);
  const envUser = process.env.PGUSER;
  const user =
    (envUser && envUser.includes(".") ? envUser : undefined) ||
    fromUrl.user ||
    "postgres.mkksxwbchrfftsdyzmeq";
  const password = process.env.PGPASSWORD || fromUrl.password;
  if (typeof password !== "string" || password.length === 0) {
    throw new Error(
      "Postgres : mot de passe absent. Sur Vercel, ajoute DATABASE_URL (postgresql://…pooler…:6543/postgres) ou PGPASSWORD — pas l’URL https ni la clé anon.",
    );
  }
  return {
    host: process.env.PGHOST || fromUrl.host || "aws-1-eu-west-1.pooler.supabase.com",
    port: Number(process.env.PGPORT || fromUrl.port || 6543),
    user,
    password,
    database: process.env.PGDATABASE || fromUrl.database || "postgres",
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

async function prepare(client: pg.PoolClient) {
  const tagged = client as pg.PoolClient & { __vsmSchema?: boolean };
  if (tagged.__vsmSchema) return;
  await client.query(`alter table products add column if not exists image_url text not null default ''`);
  await client.query(`alter table orders alter column customer_id drop not null`);
  await client.query(`
    insert into delivery_drivers (id, user_id, full_name, phone, vehicle, active, can_sell)
    select 'drv-' || substr(replace(id, '-', ''), 1, 16), id, full_name, coalesce(phone, ''), 'Moto', true, false
    from users u
    where u.role = 'LIVREUR'
      and not exists (select 1 from delivery_drivers d where d.user_id = u.id)
  `);
  tagged.__vsmSchema = true;
}

/** Lecture : pas de BEGIN (pooler transaction). */
export async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await grabClient();
  try {
    await prepare(client);
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Écritures atomiques. */
export async function withTxn<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await grabClient();
  try {
    await prepare(client);
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
