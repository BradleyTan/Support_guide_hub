"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Field, Values } from "@/lib/scenarios";

const UNIT: Partial<Record<Field["kind"], string>> = { money: "RM", percent: "%" };

/** The input form for one scenario. Values are kept as typed (strings) and validated by runScenario. */
export function ScenarioForm({ fields, values, errors, onChange }: { fields: Field[]; values: Values; errors: Record<string, string>; onChange: (key: string, value: string) => void }) {
  const currency = String(values.currency ?? "").toUpperCase() || "FX";
  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {fields.map((f) => {
        const id = `in-${f.key}`;
        const err = errors[f.key];
        const unit = f.kind === "foreign" ? currency : UNIT[f.kind];
        return (
          <div key={f.key} className="flex flex-col gap-1">
            <Label htmlFor={id} className="text-xs">
              {f.label}
            </Label>
            {f.kind === "choice" ? (
              <Select value={String(values[f.key])} onValueChange={(v) => onChange(f.key, String(v))}>
                <SelectTrigger id={id} className="w-full bg-card">
                  <SelectValue>{(v: string) => f.options?.find((o) => o.value === v)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {f.options?.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="relative">
                {unit && f.kind !== "percent" && <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>}
                <Input
                  id={id}
                  type={f.kind === "date" ? "date" : f.kind === "text" ? "text" : "text"}
                  inputMode={f.kind === "date" || f.kind === "text" ? undefined : "decimal"}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  aria-invalid={!!err}
                  aria-describedby={err ? `${id}-err` : f.help ? `${id}-help` : undefined}
                  className={`num bg-card ${unit && f.kind !== "percent" ? (unit.length > 2 ? "pl-11" : "pl-9") : ""} ${f.kind === "percent" ? "pr-7" : ""}`}
                />
                {f.kind === "percent" && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">%</span>}
              </div>
            )}
            {err ? (
              <p id={`${id}-err`} className="text-xs text-destructive">
                {err}
              </p>
            ) : (
              f.help && (
                <p id={`${id}-help`} className="text-xs text-muted-foreground">
                  {f.help}
                </p>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
