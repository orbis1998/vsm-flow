import type { QueryClient } from "@tanstack/react-query";
import { APP_STATE_KEY } from "@/lib/app-state";

let bound: QueryClient | undefined;

export function bindQueryClient(qc: QueryClient) {
  bound = qc;
}

export async function refreshAppState() {
  if (!bound) return;
  await bound.invalidateQueries({ queryKey: APP_STATE_KEY });
}
