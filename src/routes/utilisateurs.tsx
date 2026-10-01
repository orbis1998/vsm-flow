import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, KeyRound, Trash2 } from "lucide-react";
import { useAppState } from "@/lib/app-store";
import { ROLE_LIST, ROLES } from "@/lib/roles";
import { dateTime } from "@/lib/format";
import { usersService } from "@/services";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Forbidden, PageHeader } from "@/components/common/ui-bits";
import type { RoleCode, User, UserStatus } from "@/types";

export const Route = createFileRoute("/utilisateurs")({
  head: () => ({
    meta: [
      { title: `Équipe — Business Suite` },
      { name: "description", content: "Rôles, permissions et historique d'actions." },
    ],
  }),
  component: UsersPage,
});

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  badge: "",
  password: "",
  role: "GERANT" as RoleCode,
  status: "actif" as UserStatus,
  vehicle: "",
  posteId: "",
};

function UsersPage() {
  const { can, user } = useSession();
  const users = useAppState((s) => s.users);
  const logs = useAppState((s) => s.auditLogs);
  const postes = useAppState((s) => s.postes);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [pwdUser, setPwdUser] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [form, setForm] = useState(emptyForm);
  if (!can("users.view")) return <Forbidden />;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      badge: u.badge,
      password: "",
      role: u.role,
      status: u.status,
      vehicle: "",
      posteId: u.posteId ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.fullName || !form.badge) {
      toast.error("Nom et badge requis");
      return;
    }
    if (!editing && !form.password) {
      toast.error("Mot de passe requis pour un nouveau compte");
      return;
    }
    const assignedPoste = form.role === "ADMIN" ? "" : form.posteId;
    if (editing) {
      await usersService.update(editing.id, {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        badge: form.badge,
        role: form.role,
        status: form.status,
        posteId: assignedPoste,
      });
      toast.success("Membre mis à jour");
    } else {
      await usersService.create({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        badge: form.badge,
        role: form.role,
        status: form.status,
        extraPermissions: [],
        password: form.password,
        vehicle: form.vehicle,
        posteId: assignedPoste || undefined,
      });
      toast.success("Compte créé");
    }
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle={`${users.length} comptes`}
        actions={can("users.manage") && (
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Nouveau
          </Button>
        )}
      />
      <Tabs defaultValue="equipe">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="equipe">Équipe</TabsTrigger>
          <TabsTrigger value="roles">Rôles</TabsTrigger>
          <TabsTrigger value="audit">Journal</TabsTrigger>
        </TabsList>
        <TabsContent value="equipe">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="hidden sm:table-cell">Boutique</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Dernière connexion</TableHead>
                  {can("users.manage") && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.badge} · {u.email}
                      </div>
                    </TableCell>
                    <TableCell>{ROLES[u.role].label}</TableCell>
                    <TableCell className="hidden max-w-[9rem] truncate text-xs sm:table-cell">
                      {postes.find((p) => p.id === u.posteId)?.name ?? "—"}
                    </TableCell>
                    <TableCell><Badge variant="outline">{u.status}</Badge></TableCell>
                    <TableCell className="hidden text-xs md:table-cell">{u.lastLoginAt ? dateTime(u.lastLoginAt) : "—"}</TableCell>
                    {can("users.manage") && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" aria-label="Modifier" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Mot de passe" onClick={() => { setPwdUser(u.id); setNewPwd(""); }}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Supprimer"
                            disabled={u.id === user.id}
                            onClick={async () => {
                              if (u.id === user.id) return;
                              if (!confirm(`Supprimer ${u.fullName} ?`)) return;
                              await usersService.remove(u.id);
                              toast.success("Membre supprimé");
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="roles">
          <div className="grid gap-3 md:grid-cols-2">
            {ROLE_LIST.map((r) => (
              <div key={r.code} className="rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{r.label}</div>
                  <Badge>{r.enabled ? "Actif" : "Préparé"}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{r.permissions.length} permissions</p>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="audit">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quand</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, 40).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{dateTime(l.createdAt)}</TableCell>
                    <TableCell>{l.userName}</TableCell>
                    <TableCell>{l.action} · {l.entity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier le membre" : "Nouvel utilisateur"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nom</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div><Label>Badge</Label><Input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} /></div>
            {!editing && (
              <div><Label>Mot de passe</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            )}
            <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div>
              <Label>Rôle</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({ ...form, role: v as RoleCode, posteId: v === "ADMIN" ? "" : form.posteId })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_LIST.map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as UserStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="actif">Actif</SelectItem>
                  <SelectItem value="suspendu">Suspendu</SelectItem>
                  <SelectItem value="inactif">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "LIVREUR" && !editing && (
              <div>
                <Label>Véhicule</Label>
                <Input value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} />
              </div>
            )}
            {form.role !== "ADMIN" && (
            <div>
              <Label>Boutique rattachée</Label>
              <Select value={form.posteId || "none"} onValueChange={(v) => setForm({ ...form, posteId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {postes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} · {p.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Le gérant, le caissier et le livreur de cette boutique voient sa caisse, son stock et ses courses. L'admin n'est rattaché à aucune boutique : il voit tout.
              </p>
            </div>
            )}
          </div>
          <DialogFooter><Button onClick={save}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!pwdUser} onOpenChange={(o) => !o && setPwdUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau mot de passe</DialogTitle></DialogHeader>
          <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!pwdUser || newPwd.length < 4) {
                  toast.error("Mot de passe trop court");
                  return;
                }
                await usersService.setPassword(pwdUser, newPwd);
                toast.success("Mot de passe mis à jour");
                setPwdUser(null);
              }}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
