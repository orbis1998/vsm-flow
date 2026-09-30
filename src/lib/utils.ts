import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Empêche Dialog/Sheet de fermer quand on clique dans un Select portailé. */
export function ignoreSelectOutside(event: Event) {
  const el = event.target as HTMLElement | null;
  if (el?.closest("[data-radix-select-content], [data-radix-popper-content-wrapper]")) {
    event.preventDefault();
  }
}
