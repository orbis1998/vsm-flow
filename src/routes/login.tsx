import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { loginFn } from "@/fn/auth";
import { saveSession } from "@/lib/session";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `Connexion — ${APP_NAME}` },
      { name: "description", content: "Accès sécurisé à Business Suite." },
    ],
  }),
  component: LoginPage,
});

type InstallPrompt = Event & { prompt: () => Promise<void> };

function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [install, setInstall] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await loginFn({ data: { login, password } });
      saveSession(user.id);
      toast.success(`Bienvenue ${user.fullName}`);
      await navigate({ to: "/" });
      window.location.assign("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connexion impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoMark className="mx-auto mb-3 h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{APP_TAGLINE}</p>
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4">
          <div>
            <Label htmlFor="login">Badge ou e-mail</Label>
            <Input
              id="login"
              autoComplete="username"
              inputMode="email"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
        {install && (
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={async () => {
              await install.prompt();
              setInstall(null);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Installer l'application
          </Button>
        )}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Sur mobile : menu du navigateur → « Ajouter à l'écran d'accueil ».
        </p>
      </div>
    </div>
  );
}
