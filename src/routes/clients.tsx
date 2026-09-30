import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useAppState } from "@/lib/app-store";
import { communeName, zoneName, zonesOfCommune, COMMUNES } from "@/lib/geo";
import { money } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { customersService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, Forbidden, PageHeader } from "@/components/common/ui-bits";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: `Clients — ${APP_NAME}` },
      { name: "description", content: "Fichier clients, adresses Kinshasa et historique d'achats." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { can } = useSession();
  const customers = useAppState((s) => s.customers);
  const orders = useAppState((s) => s.orders);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    communeId: COMMUNES[0]!.id,
    zoneId: zonesOfCommune(COMMUNES[0]!.id)[0]!.id,
    address: "",
    notes: "",
  });
  if (!can("customers.view")) return <Forbidden />;

  const list = useMemo(
    () =>
      customers.filter((c) =>
        `${c.fullName} ${c.phone} ${c.address}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [customers, q],
  );
  const current = customers.find((c) => c.id === selected) ?? null;
  const history = current ? orders.filter((o) => o.customerId === current.id) : [];

  const save = async () => {
    if (!form.fullName || !form.phone) {
      toast.error("Nom et téléphone requis");
      return;
    }
    await customersService.create(form);
    toast.success("Client créé");
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${customers.length} fiches`}
        actions={
          can("customers.manage") && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Nouveau client
            </Button>
          )
        }
      />
      <Input placeholder="Nom, téléphone, adresse…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-xs" />
      {list.length === 0 ? (
        <Empty>Aucun client.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Zone</TableHead>
                <TableHead className="text-right">Commandes</TableHead>
                <TableHead className="text-right">Dépensé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c.id)}>
                  <TableCell>
                    <div className="font-medium">{c.fullName} {c.regular && <span className="text-xs text-primary">régulier</span>}</div>
                    <div className="text-xs text-muted-foreground">{c.phone}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{communeName(c.communeId)}, {zoneName(c.zoneId)}</TableCell>
                  <TableCell className="num text-right">{c.ordersCount}</TableCell>
                  <TableCell className="num text-right font-semibold">{money(c.totalSpent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Sheet open={!!current} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {current && (
            <>
              <SheetHeader><SheetTitle>{current.fullName}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <p>{current.phone}</p>
                <p className="text-muted-foreground">{communeName(current.communeId)}, {zoneName(current.zoneId)} — {current.address}</p>
                {current.notes && <p>{current.notes}</p>}
                <div className="font-semibold">Historique ({history.length})</div>
                {history.length === 0 && <p className="text-muted-foreground">Aucune commande.</p>}
                {history.map((o) => (
                  <div key={o.id} className="flex justify-between border-b py-2">
                    <span className="font-mono text-xs">{o.reference}</span>
                    <span className="num">{money(o.totalToCollect)}</span>
                  </div>
                ))}
                {can("customers.manage") && (
                  <Button variant="outline" className="text-destructive" onClick={async () => {
                    await customersService.remove(current.id);
                    toast.success("Client supprimé");
                    setSelected(null);
                  }}>Supprimer</Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nom</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div>
              <Label>Commune</Label>
              <Select value={form.communeId} onValueChange={(v) => setForm({ ...form, communeId: v, zoneId: zonesOfCommune(v)[0]!.id })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMMUNES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Zone</Label>
              <Select value={form.zoneId} onValueChange={(v) => setForm({ ...form, zoneId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{zonesOfCommune(form.communeId).map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
