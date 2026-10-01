import { createServerFn } from "@tanstack/react-start";

export const getVapidPublicFn = createServerFn({ method: "GET" }).handler(async () => {
  return process.env.VAPID_PUBLIC_KEY ?? "";
});

export const savePushSubscriptionFn = createServerFn({ method: "POST", strict: false })
  .validator((data: unknown) => data)
  .handler(async (ctx) => {
    let raw = ctx.data as { userId?: string; endpoint?: string; p256dh?: string; auth?: string; data?: unknown };
    if (raw && !raw.userId && raw.data && typeof raw.data === "object") {
      raw = raw.data as typeof raw;
    }
    if (!raw?.userId || !raw.endpoint || !raw.p256dh || !raw.auth) {
      throw new Error("Abonnement push incomplet.");
    }
    const { withClient } = await import("@/server/db");
    const { upsertPushSubscription } = await import("@/server/push");
    await withClient((client) =>
      upsertPushSubscription(client, {
        userId: raw.userId!,
        endpoint: raw.endpoint!,
        p256dh: raw.p256dh!,
        auth: raw.auth!,
      }),
    );
    return { ok: true };
  });
