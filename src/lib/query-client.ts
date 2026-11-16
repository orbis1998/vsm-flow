import type { QueryClient } from "@tanstack/react-query";
import { APP_STATE_KEY } from "@/lib/app-state";
import { NOTIFY_SOUNDS_KEY } from "@/lib/notify-sounds";

let bound: QueryClient | undefined;

export function bindQueryClient(qc: QueryClient) {
  bound = qc;
}

export async function refreshAppState() {
  if (!bound) return;
  await bound.invalidateQueries({ queryKey: APP_STATE_KEY });
  await bound.refetchQueries({ queryKey: APP_STATE_KEY, type: "active" });
}

export async function refreshNotifySounds() {
  if (!bound) return;
  await bound.invalidateQueries({ queryKey: NOTIFY_SOUNDS_KEY });
  await bound.refetchQueries({ queryKey: NOTIFY_SOUNDS_KEY, type: "active" });
}
