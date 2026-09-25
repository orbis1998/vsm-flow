import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ROLES } from "@/mock/roles";
import { useAppState } from "@/mock/store";
import type { Permission, RoleCode, User } from "@/types";

interface SessionValue {
  user: User;
  role: RoleCode;
  permissions: Permission[];
  posteId: string;
  setPosteId: (id: string) => void;
  /** Changement de rôle simulé : permet de visualiser l'app comme un autre profil. */
  impersonate: (userId: string) => void;
  can: (permission: Permission) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const users = useAppState((s) => s.users);
  const [userId, setUserId] = useState("usr-1");
  const [posteId, setPosteId] = useState("pos-1");

  const value = useMemo<SessionValue>(() => {
    const user = users.find((u) => u.id === userId) ?? users[0]!;
    const permissions = [
      ...new Set([...ROLES[user.role].permissions, ...user.extraPermissions]),
    ];
    return {
      user,
      role: user.role,
      permissions,
      posteId,
      setPosteId,
      impersonate: setUserId,
      can: (permission) => permissions.includes(permission),
    };
  }, [users, userId, posteId]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession doit être utilisé dans un SessionProvider");
  return ctx;
}
