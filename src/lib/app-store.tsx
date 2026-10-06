import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { APP_STATE_KEY, EMPTY_APP_STATE, type AppState } from "@/lib/app-state";
import { getAppStateFn } from "@/fn/app";
import { LogoMark } from "@/components/brand/LogoMark";

export function useAppQuery() {
  return useQuery({
    queryKey: APP_STATE_KEY,
    queryFn: () => getAppStateFn(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
    retry: 2,
  });
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  const { data } = useAppQuery();
  return selector(data ?? EMPTY_APP_STATE);
}

export function AppDataGate({ children }: { children: ReactNode }) {
  const { isPending, isError, error, data } = useAppQuery();

  if (isPending && !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <LogoMark className="logo-pulse h-12 w-12 text-primary" />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-foreground">Impossible de charger les données</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Erreur de connexion."}
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
