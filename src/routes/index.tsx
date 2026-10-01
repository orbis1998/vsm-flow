import { createFileRoute, Navigate } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/brand";
import { homePath } from "@/lib/roles";
import { useSession } from "@/hooks/useSession";
import { DashHome } from "@/components/dashboard/DashHome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Tableau de bord — ${APP_NAME}` },
      { name: "description", content: "Gains du jour, comparaison et dépenses." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { can, role } = useSession();
  if (!can("dashboard.view")) return <Navigate to={homePath(role)} />;
  return <DashHome />;
}
