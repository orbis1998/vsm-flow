import { createServerFn } from "@tanstack/react-start";

export const getVapidPublicFn = createServerFn({ method: "GET" }).handler(async () => {
  return process.env.VAPID_PUBLIC_KEY ?? "";
});

export const savePushSubscriptionFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string; endpoint: string; p256dh: string; auth: string }) => data)
  .handler(async ({ data }) => {
    const { withClient } = await import("@/server/db");
    const { upsertPushSubscription } = await import("@/server/push");
    await withClient((client) => upsertPushSubscription(client, data));
    return { ok: true };
  });
