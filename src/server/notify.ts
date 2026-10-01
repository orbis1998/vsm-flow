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
  const id = nextId("ntf");
  const href = input.href ?? "/commandes";
  try {
    await client.query(
      `insert into notifications (id, title, message, level, read, user_id, href, created_at)
       values ($1,$2,$3,$4,false,$5,$6, now())`,
      [id, input.title, input.message, input.level ?? "info", input.userId, href],
    );
  } catch {
    await client.query(
      `insert into notifications (id, title, message, level, read, user_id, created_at)
       values ($1,$2,$3,$4,false,$5, now())`,
      [id, input.title, input.message, input.level ?? "info", input.userId],
    );
  }
}

export async function notifyRoles(
  client: Client,
  roles: string[],
  payload: { title: string; message: string; level?: AppNotification["level"]; href?: string },
): Promise<string[]> {
  let res;
  try {
    res = await client.query(
      `select id from users where status = 'actif' and role = any($1::role_code[])`,
      [roles],
    );
  } catch {
    res = await client.query(
      `select id from users where status = 'actif' and role::text = any($1::text[])`,
      [roles],
    );
  }
  const ids = res.rows.map((r) => String(r.id));
  for (const userId of ids) {
    try {
      await insertNotification(client, { ...payload, userId });
    } catch {
      // continuer les autres destinataires
    }
  }
  return ids;
}

export async function notifyManagers(
  client: Client,
  payload: { title: string; message: string; level?: AppNotification["level"]; href?: string },
): Promise<string[]> {
  return notifyRoles(client, ["ADMIN", "GERANT", "RESP_LOGISTIQUE"], payload);
}
