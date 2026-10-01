import { AsyncLocalStorage } from "node:async_hooks";
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

const SCHEMA_VERSION = 4;

export type ManagerPing = {
  title: string;
  message: string;
  level?: "info" | "alerte" | "critique";
  href?: string;
};

const pingAls = new AsyncLocalStorage<{ pings: ManagerPing[] }>();

export function queueManagerPing(payload: ManagerPing) {
  const store = pingAls.getStore();
  if (store) store.pings.push(payload);
  else void flushPings([payload]);
}

async function flushPings(pings: ManagerPing[]) {
  if (!pings.length) return;
  try {
    const { notifyManagers } = await import("./notify");
    const { sendWebPush } = await import("./push");
    await withClient(async (client) => {
      for (const payload of pings) {
        try {
          const userIds = await notifyManagers(client, payload);
          if (userIds.length === 0) continue;
          await sendWebPush(client, userIds, {
            title: payload.title,
            body: payload.message,
            href: payload.href,
          });
        } catch {
          // une alerte ne doit pas en bloquer une autre
        }
      }
    });
  } catch {
    // jamais bloquer le métier
  }
}

async function prepare(client: pg.PoolClient) {
  const tagged = client as pg.PoolClient & { __vsmSchema?: number };
  if (tagged.__vsmSchema === SCHEMA_VERSION) return;
  await client.query(`alter table products add column if not exists image_url text not null default ''`);
  await client.query(`alter table orders alter column customer_id drop not null`);
  await client.query(`alter table orders add column if not exists poste_id text`);
  await client.query(`alter table notifications add column if not exists href text`);
  await client.query(`update users set poste_id = null where role = 'ADMIN' and poste_id is not null`);
  await client.query(`
    create table if not exists push_subscriptions (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      endpoint text not null unique,
      p256dh text not null,
      auth text not null,
      created_at timestamptz not null default now()
    )
  `);
  await client.query(`
    insert into delivery_drivers (id, user_id, full_name, phone, vehicle, active, can_sell)
    select 'drv-' || substr(replace(id, '-', ''), 1, 16), id, full_name, coalesce(phone, ''), 'Moto', true, false
    from users u
    where u.role = 'LIVREUR'
      and not exists (select 1 from delivery_drivers d where d.user_id = u.id)
  `);
  tagged.__vsmSchema = SCHEMA_VERSION;
}

export function friendlyPgError(error: unknown): Error {
  const e = error as { code?: string; message?: string; constraint?: string };
  if (e.code === "23503") {
    if (e.constraint?.includes("customer")) {
      return new Error("Client introuvable. Laissez vide ou choisissez un client de la liste.");
    }
    if (e.constraint?.includes("commune") || e.constraint?.includes("zone")) {
      return new Error("Choisissez une commune et un quartier.");
    }
    return new Error("Une référence est invalide (client, commune, quartier ou boutique).");
  }
  if (e.code === "23505") return new Error("Cette référence existe déjà. Réessayez.");
  if (e.code === "23502") return new Error("Un champ obligatoire est vide.");
  if (e.code === "25P02") return new Error("Enregistrement interrompu. Réessayez.");
  if (typeof e.message === "string" && /aborted/i.test(e.message)) {
    return new Error("Enregistrement interrompu. Réessayez.");
  }
  return error instanceof Error ? error : new Error("Enregistrement impossible.");
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

/** Écritures atomiques. Les notifications partent après COMMIT, sur une autre connexion. */
export async function withTxn<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const store: { pings: ManagerPing[] } = { pings: [] };
  return pingAls.run(store, async () => {
    const client = await grabClient();
    let result: T;
    try {
      await prepare(client);
      let started = false;
      try {
        await client.query("begin");
        started = true;
      } catch {
        started = false;
      }
      result = await fn(client);
      if (started) await client.query("commit");
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {
        // ignore
      }
      throw friendlyPgError(error);
    } finally {
      client.release();
    }
    await flushPings(store.pings);
    return result!;
  });
}
