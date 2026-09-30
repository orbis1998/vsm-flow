import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  LayoutDashboard,
  LogOut,
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
import { usePushNotifications } from "@/hooks/usePush";
import { useAppState } from "@/lib/app-store";
import { ROLES } from "@/lib/roles";
import { APP_NAME } from "@/lib/brand";
import { dateTime, initials } from "@/lib/format";
import { notificationsService } from "@/services";
import { LogoMark } from "@/components/brand/LogoMark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Permission, RoleCode } from "@/types";

const NAV: Array<{
  to: string;
  label: string;
  icon: typeof Package;
  perm: Permission;
  only?: RoleCode[];
}> = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, perm: "dashboard.view" },
  { to: "/commandes", label: "Commandes", icon: ClipboardList, perm: "orders.view" },
  { to: "/pos", label: "Caisse", icon: ShoppingCart, perm: "pos.use" },
  { to: "/produits", label: "Articles", icon: Package, perm: "products.view" },
  { to: "/stock", label: "Stock", icon: Boxes, perm: "stock.view" },
  { to: "/logistique", label: "Livraisons", icon: Truck, perm: "logistics.view" },
  { to: "/livreur", label: "Mes courses", icon: Bike, perm: "driver.space", only: ["LIVREUR"] },
  { to: "/clients", label: "Clients", icon: Users, perm: "customers.view" },
  { to: "/fournisseurs", label: "Fournisseurs", icon: Building2, perm: "suppliers.view" },
  { to: "/finance", label: "Finance", icon: Wallet, perm: "finance.view" },
  { to: "/rapports", label: "Rapports", icon: BarChart3, perm: "reports.view" },
  { to: "/utilisateurs", label: "Équipe", icon: UserCog, perm: "users.view" },
  { to: "/parametres", label: "Paramètres", icon: Settings, perm: "settings.view" },
];

const MOBILE_BY_ROLE: Partial<Record<RoleCode, string[]>> = {
  LIVREUR: ["/livreur", "/pos"],
  CAISSIER: ["/", "/pos", "/clients"],
  MAGASINIER: ["/", "/stock", "/produits"],
  COMPTABLE: ["/", "/finance", "/rapports"],
  RESP_LOGISTIQUE: ["/", "/commandes", "/logistique"],
};

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { can, role } = useSession();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter((n) => can(n.perm) && (!n.only || n.only.includes(role)));
  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map((n) => {
        const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
        const Icon = n.icon;
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              active && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  const company = useAppState((s) => s.company);
  const subtitle = company.name && company.name !== APP_NAME ? company.name : "Commerce · Stock · Livraison";
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
      <LogoMark className="h-8 w-8 shrink-0 text-primary" />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-semibold tracking-tight text-sidebar-foreground">{APP_NAME}</div>
        <div className="truncate text-[11px] text-sidebar-foreground/55">{subtitle}</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user, role, posteId, setPosteId, logout, can } = useSession();
  const navigate = useNavigate();
  const postes = useAppState((s) => s.postes);
  const notifications = useAppState((s) => s.notifications);
  const path = useRouterState({ select: (s) => s.location.pathname });
  usePushNotifications(user.id);

  const mine = useMemo(
    () => notifications.filter((n) => !n.userId || n.userId === user.id),
    [notifications, user.id],
  );
  const unread = mine.filter((n) => !n.read);
  const seen = useRef(new Set<string>());
  const primed = useRef(false);

  useEffect(() => {
    if (!primed.current) {
      mine.forEach((n) => seen.current.add(n.id));
      primed.current = true;
      return;
    }
    for (const n of unread) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      toast(n.title, { description: n.message });
    }
  }, [mine, unread]);

  const mobilePaths = MOBILE_BY_ROLE[role] ?? ["/", "/commandes", "/pos", "/stock"];
  const mobileNav = NAV.filter(
    (n) => can(n.perm) && (!n.only || n.only.includes(role)) && mobilePaths.includes(n.to),
  );

  return (
    <div className="flex min-h-dvh bg-background pb-16 lg:pb-0">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto bg-sidebar lg:flex">
        <Brand />
        <Nav />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0">
          <Brand />
          <Nav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="flex min-h-14 items-center gap-2 px-3 py-2 sm:px-4">
          <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
          {postes.length > 0 ? (
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <label className="mb-0.5 block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Boutique / caisse
              </label>
              <Select value={posteId || postes[0]!.id} onValueChange={setPosteId}>
                <SelectTrigger className="h-9 w-full min-w-0 text-xs" aria-label="Boutique ou point de vente">
                  <SelectValue placeholder="Choisir une boutique" />
                </SelectTrigger>
                <SelectContent>
                  {postes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : can("settings.manage") ? (
            <Link to="/parametres" className="min-w-0 flex-1 truncate text-xs text-muted-foreground underline">
              Créer une boutique dans Paramètres
            </Link>
          ) : (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Aucune boutique</span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unread.length > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {unread.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-sm font-semibold">Notifications</span>
                <button className="text-xs text-primary" onClick={() => notificationsService.markAllRead(user.id)}>
                  Tout marquer lu
                </button>
              </div>
              <div className="max-h-80 overflow-auto">
                {mine.length === 0 && <p className="p-3 text-sm text-muted-foreground">Aucune notification.</p>}
                {mine.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={cn("block w-full border-b px-3 py-2 text-left text-sm", !n.read && "bg-muted/60")}
                    onClick={() => navigate({ to: n.href || "/commandes" })}
                  >
                    <div className={cn("font-medium", n.level === "critique" && "text-primary")}>{n.title}</div>
                    <div className="text-xs text-muted-foreground">{n.message}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{dateTime(n.createdAt)}</div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
              {initials(user.fullName || "A")}
            </span>
            <span className="hidden text-left text-xs leading-tight sm:block">
              <span className="block max-w-[120px] truncate font-semibold">{user.fullName}</span>
              <span className="block text-muted-foreground">{ROLES[user.role]?.label}</span>
            </span>
            <Button variant="ghost" size="icon" aria-label="Déconnexion" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 px-1 py-1 backdrop-blur lg:hidden">
        {mobileNav.slice(0, 4).map((n) => {
          const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[10px] font-medium leading-tight",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="w-full truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
