import type { NotificationSoundEvent } from "@/types";

export const NOTIFY_SOUNDS_KEY = ["notification-sounds"] as const;

export const NOTIFY_SOUND_EVENTS = [
  "nouvelle",
  "assignee",
  "en_livraison",
  "livree",
  "echec",
  "stock_recu",
] as const satisfies readonly NotificationSoundEvent[];

export const NOTIFY_SOUND_LABELS: Record<NotificationSoundEvent, string> = {
  nouvelle: "Nouvelle commande (non assignée)",
  assignee: "Course assignée au livreur",
  en_livraison: "Livreur en route",
  livree: "Commande livrée",
  echec: "Livraison en échec",
  stock_recu: "Stock reçu par le livreur",
};

export const NOTIFY_SOUND_HINTS: Record<NotificationSoundEvent, string> = {
  nouvelle: "Quand une commande arrive dans le pool, sans livreur.",
  assignee: "Quand un livreur reçoit une course.",
  en_livraison: "Quand le livreur clique « En route ».",
  livree: "Quand le livreur clique « Livrer ».",
  echec: "Quand une livraison passe en échec.",
  stock_recu: "Quand une dotation arrive dans le sac du livreur.",
};

export const MAX_NOTIFY_SOUND_BYTES = 512 * 1024;

const PLAYERS = new Map<string, HTMLAudioElement>();

export function isNotifySoundEvent(value: string): value is NotificationSoundEvent {
  return (NOTIFY_SOUND_EVENTS as readonly string[]).includes(value);
}

export function inferNotifySound(title: string, message = ""): NotificationSoundEvent | undefined {
  const t = `${title} ${message}`.toLowerCase();
  if (t.includes("en route")) return "en_livraison";
  if (t.includes("livrée") || t.includes("livree")) return "livree";
  if (t.includes("échec") || t.includes("echec")) return "echec";
  if (t.includes("stock reçu") || t.includes("stock recu")) return "stock_recu";
  if (t.includes("course assignée") || t.includes("livreur assigné") || t.includes("assignée") || t.includes("assignee")) {
    return "assignee";
  }
  if (t.includes("nouvelle commande")) return "nouvelle";
  return undefined;
}

export function unlockNotifyAudio() {
  const silent = new Audio();
  silent.muted = true;
  void silent.play().catch(() => undefined);
}

export function playNotifySound(event: NotificationSoundEvent, dataUrl: string) {
  if (!dataUrl.startsWith("data:audio/")) return;
  try {
    const prev = PLAYERS.get(event);
    if (prev) {
      prev.pause();
      prev.currentTime = 0;
    }
    const audio = new Audio(dataUrl);
    PLAYERS.set(event, audio);
    void audio.play().catch(() => undefined);
  } catch {
    // lecture bloquée par le navigateur
  }
}

export function readNotifySoundFile(file: File): Promise<{ fileName: string; mime: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const mime = file.type || "audio/mpeg";
    if (!mime.startsWith("audio/")) {
      reject(new Error("Choisissez un fichier audio (mp3, wav, ogg, m4a…)."));
      return;
    }
    if (file.size > MAX_NOTIFY_SOUND_BYTES) {
      reject(new Error("Fichier trop lourd (maximum 512 Ko)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      if (!dataUrl.startsWith("data:audio/")) {
        reject(new Error("Fichier audio illisible."));
        return;
      }
      resolve({ fileName: file.name.slice(0, 180), mime, dataUrl });
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}
