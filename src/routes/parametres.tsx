import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAppState } from "@/lib/app-store";
import { settingsService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { APP_NAME } from "@/lib/brand";
import { moneyCdf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Forbidden, PageHeader } from "@/components/common/ui-bits";
import { BoutiqueCard } from "@/components/common/BoutiqueCard";
import { Pencil, Trash2 } from "lucide-react";
import type { Poste } from "@/types";

export const Route = createFileRoute("/parametres")({
  head: () => ({
    meta: [{ title: `Paramètres — ${APP_NAME}` }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { can } = useSession();
  const company = useAppState((s) => s.company);
  const postes = useAppState((s) => s.postes);
  const communes = useAppState((s) => s.communes);
  const zones = useAppState((s) => s.zones);
  const [form, setForm] = useState(company);
  const [poste, setPoste] = useState({ name: "", address: "", type: "boutique" as Poste["type"] });
  if (!can("settings.view")) return <Forbidden />;

  return (
    <div>
      <PageHeader title="Paramètres" subtitle={company.name || APP_NAME} />
      <Tabs defaultValue="entreprise">
        <TabsList className="flex-wrap">
          <TabsTrigger value="entreprise">Entreprise</TabsTrigger>
          <TabsTrigger value="postes">Boutiques</TabsTrigger>
          <TabsTrigger value="livraison">Grille livraison</TabsTrigger>
        </TabsList>
        <TabsContent value="entreprise" className="max-w-lg space-y-3">
          <div>
            <Label>Nom commercial</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!can("settings.manage")} />
          </div>
          <div>
            <Label>Raison sociale</Label>
            <Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} disabled={!can("settings.manage")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!can("settings.manage")} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!can("settings.manage")} />
            </div>
          </div>
          <div>
            <Label>Taux USD → CDF</Label>
            <Input
              type="number"
              value={form.usdCdfRate}
              onChange={(e) => setForm({ ...form, usdCdfRate: +e.target.value })}
              disabled={!can("settings.manage")}
            />
            <p className="mt-1 text-xs text-muted-foreground">1 $ = {form.usdCdfRate} CDF. Les articles sont en USD, les frais de livraison en CDF.</p>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label>Alerte stock bas</Label>
            <Switch checked={form.lowStockAlert} onCheckedChange={(v) => setForm({ ...form, lowStockAlert: v })} disabled={!can("settings.manage")} />
          </div>
          {can("settings.manage") && (
            <Button
              onClick={async () => {
                await settingsService.updateCompany(form);
                toast.success("Enregistré");
              }}
            >
              Enregistrer
            </Button>
          )}
        </TabsContent>
        <TabsContent value="postes" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Une boutique est un point de vente : caisse, stock consultable, gérant, caissier et livreur. Créez-la ici, puis rattachez l'équipe dans Équipe. L'administrateur n'est lié à aucune boutique — son tableau de bord reste global.
          </p>
          {can("settings.manage") && (
            <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-4">
              <Input placeholder="Nom (ex. Boutique Gombe)" value={poste.name} onChange={(e) => setPoste({ ...poste, name: e.target.value })} />
              <Input placeholder="Adresse" value={poste.address} onChange={(e) => setPoste({ ...poste, address: e.target.value })} />
              <Select value={poste.type} onValueChange={(v) => setPoste({ ...poste, type: v as Poste["type"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boutique">Boutique</SelectItem>
                  <SelectItem value="entrepot">Entrepôt</SelectItem>
                  <SelectItem value="mobile">Vente mobile</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={async () => {
                  if (!poste.name) return toast.error("Nom requis");
                  await settingsService.createPoste(poste);
                  toast.success("Poste créé");
                  setPoste({ name: "", address: "", type: "boutique" });
                }}
              >
                Ajouter
              </Button>
            </div>
          )}
          {postes.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {postes.map((p) => (
                <div key={p.id} className="relative">
                  <BoutiqueCard poste={p} />
                  {can("settings.manage") && (
                    <div className="absolute right-2 top-2 flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Renommer"
                        onClick={async () => {
                          const name = window.prompt("Nouveau nom", p.name);
                          if (!name) return;
                          await settingsService.updatePoste(p.id, { name });
                          toast.success("Boutique mise à jour");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Supprimer"
                        onClick={async () => {
                          if (!confirm(`Supprimer « ${p.name} » ?`)) return;
                          try {
                            await settingsService.removePoste(p.id);
                            toast.success("Boutique supprimée");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Suppression impossible");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {postes.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune boutique pour l'instant.</p>
          )}
        </TabsContent>
        <TabsContent value="livraison">
          <p className="mb-3 text-sm text-muted-foreground">
            Frais toujours en CDF, hors chiffre d'affaires. {communes.length} communes.
          </p>
          <div className="max-h-[70dvh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commune</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead className="text-right">Frais CDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell>{communes.find((c) => c.id === z.communeId)?.name}</TableCell>
                    <TableCell>{z.name}</TableCell>
                    <TableCell className="text-right">
                      {can("settings.manage") ? (
                        <Input
                          className="ml-auto h-8 w-24 text-right"
                          type="number"
                          defaultValue={z.defaultFee}
                          onBlur={async (e) => {
                            const n = Number(e.target.value);
                            if (n === z.defaultFee) return;
                            await settingsService.updateZoneFee(z.id, n);
                            toast.success(`${z.name} : ${moneyCdf(n)}`);
                          }}
                        />
                      ) : (
                        moneyCdf(z.defaultFee)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
