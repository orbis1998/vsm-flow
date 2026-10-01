import { createServerFn } from "@tanstack/react-start";

export type PublicUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  badge: string;
  role: string;
  status: string;
  posteId?: string;
};

export const loginFn = createServerFn({ method: "POST", strict: false })
  .validator((data: { login: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { withClient } = await import("@/server/db");
    const { verifyPassword } = await import("@/server/password");
    const login = data.login.trim();
    const row = await withClient(async (client) => {
      const res = await client.query(
        `select id, full_name, email, phone, badge, role, status, poste_id, password_hash
         from users
         where status = 'actif' and (lower(badge) = lower($1) or lower(email) = lower($1))
         limit 1`,
        [login],
      );
      return res.rows[0];
    });
    if (!row || !verifyPassword(data.password, String(row.password_hash ?? ""))) {
      throw new Error("Identifiant ou mot de passe incorrect.");
    }
    await withClient(async (client) => {
      await client.query("update users set last_login_at = now() where id = $1", [row.id]);
    });
    const user: PublicUser = {
      id: String(row.id),
      fullName: String(row.full_name),
      email: String(row.email),
      phone: String(row.phone ?? ""),
      badge: String(row.badge ?? ""),
      role: String(row.role),
      status: String(row.status),
    };
    if (row.poste_id && String(row.role) !== "ADMIN") user.posteId = String(row.poste_id);
    return user;
  });
