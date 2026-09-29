import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { APP_STATE_KEY, EMPTY_APP_STATE, type AppState } from "@/lib/app-state";
import { getAppStateFn } from "@/fn/app";

export function useAppQuery() {
  return useQuery({
    queryKey: APP_STATE_KEY,
    queryFn: () => getAppStateFn(),
    staleTime: 12_000,
    refetchInterval: 25_000,
    retry: 3,
  });
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  const { data } = useAppQuery();
  return selector(data ?? EMPTY_APP_STATE);
}

export function AppDataGate({ children }: { children: ReactNode }) {
  const { isPending, isError, error } = useAppQuery();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-pulse rounded-sm bg-primary" />
          <p className="text-sm font-medium text-foreground">Chargement de Business Suite…</p>
          <p className="mt-1 text-xs text-muted-foreground">Connexion à la base de données</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-foreground">Impossible de charger les données</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Erreur de connexion à Postgres."}
          </p>
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return children;
}
