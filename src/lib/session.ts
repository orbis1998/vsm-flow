const KEY = "business-suite.session";

export function saveSession(userId: string, posteId?: string) {
  const prev = loadSession();
  const keep = prev?.userId === userId ? prev.posteId : "";
  localStorage.setItem(KEY, JSON.stringify({ userId, posteId: posteId || keep || "" }));
}

export function loadSession(): { userId: string; posteId?: string } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; posteId?: string };
    if (!parsed.userId) return null;
    return { userId: parsed.userId, posteId: parsed.posteId };
  } catch {
    return null;
  }
}

export function savePoste(posteId: string) {
  const s = loadSession();
  if (s) saveSession(s.userId, posteId);
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
