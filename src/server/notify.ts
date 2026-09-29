import type { PoolClient } from "pg";
import { nextId } from "@/lib/app-state";
import type { AppNotification } from "@/types";

type Client = PoolClient;

export async function insertNotification(
  client: Client,
  input: {
    title: string;
    message: string;
    level?: AppNotification["level"];
    userId: string;
    href?: string;
  },
): Promise<void> {
  await client.query(
    `insert into notifications (id, title, message, level, read, user_id, href, created_at)
     values ($1,$2,$3,$4,false,$5,$6, now())`,
    [nextId("ntf"), input.title, input.message, input.level ?? "info", input.userId, input.href ?? "/commandes"],
  );
}

export async function notifyRoles(
  client: Client,
  roles: string[],
  payload: { title: string; message: string; level?: AppNotification["level"]; href?: string },
): Promise<string[]> {
  const res = await client.query(
    `select id from users where status = 'actif' and role = any($1::text[])`,
    [roles],
  );
  const ids = res.rows.map((r) => String(r.id));
  for (const userId of ids) {
    await insertNotification(client, { ...payload, userId });
  }
  return ids;
}

export async function notifyManagers(
  client: Client,
  payload: { title: string; message: string; level?: AppNotification["level"]; href?: string },
): Promise<string[]> {
  return notifyRoles(client, ["ADMIN", "GERANT", "RESP_LOGISTIQUE"], payload);
}
