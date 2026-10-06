import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAppState } from "@/lib/app-store";
import { EXPENSE_LABEL, money, dateTime } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { financeService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { AmountInput, toNumber } from "@/lib/amount";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Forbidden, PageHeader, StatCard } from "@/components/common/ui-bits";
import type { ExpenseCategory } from "@/types";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: `Finance — ${APP_NAME}` },
      { name: "description", content: "Caisse, dépenses, encaissements et clôtures." },
    ],
  }),
  component: FinancePage,
});

const EXPENSE_CATS: ExpenseCategory[] = ["restock", "salaires", "loyer", "forfait", "divers", "transport", "marketing", "fournitures"];

function FinancePage() {
  const { can } = useSession();
  const sales = useAppState((s) => s.sales);
  const orders = useAppState((s) => s.orders);
  const expenses = useAppState((s) => s.expenses);
  const transactions = useAppState((s) => s.transactions);
  const cashSessions = useAppState((s) => s.cashSessions);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", category: "divers" as ExpenseCategory, amount: "" });
  if (!can("finance.view")) return <Forbidden />;

  const delivered = orders.filter((o) => o.status === "livree");
  const revenue = sales.reduce((n, s) => n + s.total, 0) + delivered.reduce((n, o) => n + o.productsTotal, 0);
  const spent = expenses.reduce((n, e) => n + e.amount, 0);
  const toCollect = orders
    .filter((o) => ["assignee", "en_livraison", "prete"].includes(o.status))
    .reduce((n, o) => n + o.totalToCollect, 0);

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Synthèse, caisse et mouvements"
        actions={can("finance.manage") && <Button onClick={() => setOpen(true)}>Nouvelle dépense</Button>}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Chiffre d'affaires" value={money(revenue)} accent />
        <StatCard label="Dépenses" value={money(spent)} />
        <StatCard label="Résultat" value={money(revenue - spent)} />
        <StatCard label="À encaisser" value={money(toCollect)} />
      </div>
      <Tabs defaultValue="mouvements" className="mt-6">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
          <TabsTrigger value="depenses">Dépenses</TabsTrigger>
          <TabsTrigger value="caisse">Caisse</TabsTrigger>
        </TabsList>
        <TabsContent value="mouvements">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 40).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{dateTime(t.createdAt)}</TableCell>
                    <TableCell>{t.label}</TableCell>
                    <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                    <TableCell className={`num text-right font-semibold ${t.direction === "sortie" ? "text-destructive" : ""}`}>
                      {t.direction === "sortie" ? "−" : "+"}{money(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="depenses">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.reference}</TableCell>
                    <TableCell>{e.label}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="num text-right">{money(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="caisse">
          <div className="space-y-3">
            {cashSessions.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-4">
                <div>
                  <div className="font-semibold">{c.openedBy} · {c.status === "ouverte" ? "Ouverte" : "Clôturée"}</div>
                  <div className="text-xs text-muted-foreground">Ouverture {money(c.openingAmount)} · attendu {money(c.expectedAmount)}</div>
                </div>
                {can("finance.manage") && c.status === "ouverte" && (
                  <Button variant="outline" onClick={async () => {
                    await financeService.closeCashSession(c.id, c.expectedAmount);
                    toast.success("Caisse clôturée");
                  }}>Clôturer</Button>
                )}
                {c.status === "cloturee" && <span className="num text-sm">{money(c.closingAmount ?? 0)}</span>}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle dépense</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Libellé</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
            <div>
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as ExpenseCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATS.map((c) => <SelectItem key={c} value={c}>{EXPENSE_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Montant (USD)</Label><AmountInput value={form.amount} onValueChange={(amount) => setForm({ ...form, amount })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              const amount = toNumber(form.amount);
              if (!form.label || amount <= 0) { toast.error("Libellé et montant requis"); return; }
              await financeService.addExpense({ ...form, amount });
              toast.success("Dépense enregistrée");
              setForm({ label: "", category: "divers", amount: "" });
              setOpen(false);
            }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
