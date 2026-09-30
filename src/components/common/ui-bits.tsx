import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABEL } from "@/lib/format";
import type { OrderStatus } from "@/types";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex min-w-0 flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 break-words text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className={cn("min-w-0 rounded-md", accent && "border-primary")}>
      <CardContent className="min-w-0 p-3 sm:p-4">
        <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{label}</div>
        <div className={cn("num mt-1 break-words text-lg font-bold leading-tight sm:text-2xl", accent && "text-primary")}>{value}</div>
        {hint && <div className="mt-1 break-words text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  nouvelle: "bg-foreground text-background",
  a_preparer: "bg-secondary text-secondary-foreground",
  prete: "bg-secondary text-secondary-foreground",
  assignee: "border-foreground bg-background text-foreground",
  en_livraison: "bg-primary/15 text-primary border-primary/30",
  livree: "bg-primary text-primary-foreground",
  echec: "border-destructive bg-background text-destructive",
  retour: "bg-muted text-muted-foreground",
  annulee: "bg-muted text-muted-foreground line-through",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap rounded-sm font-medium", STATUS_STYLE[status])}>
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Forbidden() {
  return <Empty>Votre profil n'a pas accès à cette section.</Empty>;
}
