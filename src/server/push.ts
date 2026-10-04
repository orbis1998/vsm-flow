import type { PoolClient } from "pg";

type Client = PoolClient;

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

export async function sendWebPush(
  client: Client,
  userIds: string[],
  payload: { title: string; body: string; href?: string },
): Promise<void> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey || userIds.length === 0) return;

  let webpush: typeof import("web-push");
  try {
    webpush = await import("web-push");
  } catch {
    return;
  }

  webpush.setVapidDetails("mailto:ops@business-suite.local", publicKey, privateKey);
  const subs = await client.query(
    `select id, endpoint, p256dh, auth from push_subscriptions where user_id = any($1::text[])`,
    [userIds],
  );
  const href = payload.href ?? "/commandes";
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    href,
    tag: href,
  });
  for (const row of subs.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: String(row.endpoint),
          keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
        },
        body,
        { urgency: "high", TTL: 60 * 60 * 12 },
      );
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410) {
        await client.query("delete from push_subscriptions where id = $1", [row.id]);
      }
    }
  }
}

export async function upsertPushSubscription(
  client: Client,
  input: { userId: string; endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  const { nextId } = await import("@/lib/app-state");
  await client.query(
    `insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
     values ($1,$2,$3,$4,$5, now())
     on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [nextId("psb"), input.userId, input.endpoint, input.p256dh, input.auth],
  );
}
