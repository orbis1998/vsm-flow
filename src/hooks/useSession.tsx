import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ROLES, canOpenPath, homePath } from "@/lib/roles";
import { useAppState } from "@/lib/app-store";
import { clearSession, loadSession, savePoste, saveSession } from "@/lib/session";
import type { Permission, RoleCode, User } from "@/types";

interface SessionValue {
  user: User;
  role: RoleCode;
  permissions: Permission[];
  posteId: string;
  setPosteId: (id: string) => void;
  logout: () => void;
  can: (permission: Permission) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

const GUEST: User = {
  id: "",
  fullName: "",
  email: "",
  phone: "",
  badge: "",
  role: "ADMIN",
  status: "inactif",
  extraPermissions: [],
  createdAt: new Date().toISOString(),
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const users = useAppState((s) => s.users);
  const postes = useAppState((s) => s.postes);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [userId, setUserId] = useState<string | null>(null);
  const [posteId, setPosteId] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = loadSession();
    setUserId(s?.userId ?? null);
    if (s?.posteId) setPosteId(s.posteId);
    setReady(true);
  }, []);

  const user = users.find((u) => u.id === userId) ?? null;

  useEffect(() => {
    if (!ready) return;
    if (pathname === "/login") return;
    if (!userId || !user) {
      navigate({ to: "/login" });
      return;
    }
    if (!canOpenPath(user.role, user.extraPermissions ?? [], pathname)) {
      navigate({ to: homePath(user.role) });
    }
  }, [ready, userId, user, pathname, navigate]);

  useEffect(() => {
    if (!ready || posteId) return;
    const next = user?.posteId || postes[0]?.id;
    if (next) {
      setPosteId(next);
      savePoste(next);
    }
  }, [ready, user, postes, posteId]);

  const value = useMemo<SessionValue>(() => {
    const current = user ?? GUEST;
    const permissions = current.id
      ? [...new Set([...ROLES[current.role].permissions, ...current.extraPermissions])]
      : [];
    return {
      user: current,
      role: current.role,
      permissions,
      posteId,
      setPosteId: (id: string) => {
        setPosteId(id);
        savePoste(id);
      },
      logout: () => {
        clearSession();
        setUserId(null);
        navigate({ to: "/login" });
      },
      can: (permission) => permissions.includes(permission),
    };
  }, [user, posteId, navigate]);

  if (!ready) return null;
  if (pathname !== "/login" && (!userId || !user)) return null;

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession doit être utilisé dans un SessionProvider");
  return ctx;
}

export { saveSession };
