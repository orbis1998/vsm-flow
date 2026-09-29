import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

export function toNumber(raw: string): number {
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

type AmountProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (raw: string) => void;
};

export function AmountInput({ value, onValueChange, ...props }: AmountProps) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      {...props}
    />
  );
}
