import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getNotificationSoundsFn } from "@/fn/app";
import { NOTIFY_SOUNDS_KEY } from "@/lib/notify-sounds";
import type { NotificationSound, NotificationSoundEvent } from "@/types";

export function useNotifySounds() {
  return useQuery({
    queryKey: NOTIFY_SOUNDS_KEY,
    queryFn: () => getNotificationSoundsFn() as Promise<NotificationSound[]>,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useNotifySoundMap() {
  const { data } = useNotifySounds();
  return useMemo(() => {
    const map = new Map<NotificationSoundEvent, NotificationSound>();
    for (const sound of data ?? []) map.set(sound.event, sound);
    return map;
  }, [data]);
}
