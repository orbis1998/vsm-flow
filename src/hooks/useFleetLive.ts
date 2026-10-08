import { useQuery } from "@tanstack/react-query";
import { getFleetLiveFn } from "@/fn/app";

export function useFleetLive(enabled: boolean) {
  return useQuery({
    queryKey: ["fleet-live"],
    queryFn: () => getFleetLiveFn(),
    enabled,
    refetchInterval: enabled ? 5_000 : false,
    staleTime: 3_000,
    refetchOnWindowFocus: enabled,
  });
}
