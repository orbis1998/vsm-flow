import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useAppState } from "@/lib/app-store";
import { money } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";
import { suppliersService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Forbidden, PageHeader, StatCard } from "@/components/common/ui-bits";

export const Route = createFileRoute("/fournisseurs")({
  head: () => ({
    meta: [
      { title: `Fournisseurs — ${APP_NAME}` },
      { name: "description", content: "Fournisseurs, dettes et réceptions d'achats." },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const { can } = useSession();
  const suppliers = useAppState((s) => s.suppliers);
  const purchaseOrders = useAppState((s) => s.purchaseOrders);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contactName: "", phone: "", email: "", address: "", debt: 0 });
  if (!can("suppliers.view")) return <Forbidden />;

  const list = suppliers.filter((s) => `${s.name} ${s.contactName}`.toLowerCase().includes(q.toLowerCase()));
  const debt = suppliers.reduce((n, s) => n + s.debt, 0);

  const save = async () => {
    if (!form.name) { toast.error("Nom requis"); return; }
    await suppliersService.create(form);
    toast.success("Fournisseur créé");
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Fournisseurs & achats"
        subtitle={`${suppliers.length} partenaires`}
        actions={can("suppliers.manage") && <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Nouveau</Button>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Dettes fournisseurs" value={money(debt)} accent />
        <StatCard label="Commandes d'achat" value={purchaseOrders.length} />
      </div>
      <Tabs defaultValue="liste">
        <TabsList>
          <TabsTrigger value="liste">Fournisseurs</TabsTrigger>
          <TabsTrigger value="achats">Commandes d'achat</TabsTrigger>
        </TabsList>
        <TabsContent value="liste">
          <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-xs" />
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="text-right">Dette</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.address}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{s.contactName} · {s.phone}</TableCell>
                    <TableCell className="num text-right font-semibold">{money(s.debt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="achats">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                    <TableCell>{suppliers.find((s) => s.id === p.supplierId)?.name}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell className="num text-right">{money(p.total)}</TableCell>
                    <TableCell>
                      {can("suppliers.manage") && p.status !== "recue" && p.status !== "annulee" && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          await suppliersService.receivePurchaseOrder(p.id);
                          toast.success(`Réception ${p.reference}`);
                        }}>Réceptionner</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">La réception ajoute les quantités au stock.</p>
        </TabsContent>
      </Tabs>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau fournisseur</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Contact</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
