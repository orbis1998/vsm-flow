const KEY = "business-suite.session";

export function saveSession(userId: string) {
  localStorage.setItem(KEY, JSON.stringify({ userId }));
}

export function loadSession(): { userId: string } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string };
    if (!parsed.userId) return null;
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
