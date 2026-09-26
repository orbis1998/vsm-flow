import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  Wallet,
  ClipboardList,
  Bike,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useAppState } from "@/mock/store";
import { ROLES } from "@/mock/roles";
import { initials } from "@/lib/format";
import { notificationsService } from "@/services";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Permission } from "@/types";

const NAV: Array<{ to: string; label: string; icon: typeof Package; perm: Permission }> = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, perm: "dashboard.view" },
  { to: "/commandes", label: "Commandes", icon: ClipboardList, perm: "orders.view" },
  { to: "/produits", label: "Produits", icon: Package, perm: "products.view" },
  { to: "/stock", label: "Stock", icon: Boxes, perm: "stock.view" },
  { to: "/pos", label: "Point de vente", icon: ShoppingCart, perm: "pos.use" },
  { to: "/logistique", label: "Logistique", icon: Truck, perm: "logistics.view" },
  { to: "/clients", label: "Clients", icon: Users, perm: "customers.view" },
  { to: "/fournisseurs", label: "Fournisseurs", icon: Building2, perm: "suppliers.view" },
  { to: "/finance", label: "Finance", icon: Wallet, perm: "finance.view" },
  { to: "/rapports", label: "Rapports", icon: BarChart3, perm: "reports.view" },
  { to: "/utilisateurs", label: "Utilisateurs", icon: UserCog, perm: "users.view" },
  { to: "/parametres", label: "Paramètres", icon: Settings, perm: "settings.view" },
  { to: "/livreur", label: "Espace livreur", icon: Bike, perm: "driver.space" },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useSession();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.filter((n) => can(n.perm)).map((n) => {
        const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
        const Icon = n.icon;
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              active && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-sm font-black text-primary-foreground">
        V
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold text-sidebar-foreground">VSM Business Suite</div>
        <div className="text-[11px] text-sidebar-foreground/60">VSM Collection</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user, posteId, setPosteId, impersonate } = useSession();
  const users = useAppState((s) => s.users);
  const postes = useAppState((s) => s.postes);
  const notifications = useAppState((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto bg-sidebar lg:flex">
        <Brand />
        <Nav />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 border-0 bg-sidebar p-0">
          <Brand />
          <Nav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
          <Select value={posteId} onValueChange={setPosteId}>
            <SelectTrigger className="h-8 w-auto max-w-[160px] text-xs sm:max-w-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {postes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {unread}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-sm font-semibold">Notifications</span>
                <button className="text-xs text-primary" onClick={() => notificationsService.markAllRead()}>
                  Tout marquer lu
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className={cn("border-b px-3 py-2 text-sm", !n.read && "bg-muted/60")}>
                    <div className={cn("font-medium", n.level === "critique" && "text-primary")}>{n.title}</div>
                    <div className="text-xs text-muted-foreground">{n.message}</div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Select value={user.id} onValueChange={impersonate}>
            <SelectTrigger className="h-9 w-auto gap-2 border-0 px-1 sm:px-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                {initials(user.fullName)}
              </span>
              <span className="hidden text-left text-xs leading-tight sm:block">
                <span className="block font-semibold">{user.fullName}</span>
                <span className="block text-muted-foreground">{ROLES[user.role].label}</span>
              </span>
            </SelectTrigger>
            <SelectContent align="end">
              {users
                .filter((u) => ROLES[u.role].enabled && u.status === "actif")
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName} — {ROLES[u.role].label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
