/**
 * CapacityDisplay — exibe capacidade frigorífica em múltiplas unidades
 *
 * Fatores de conversão (base: Watts):
 *   1 W = 0.001 kW
 *   1 W = 0.86 kcal/h
 *   1 W = 3.41214 BTU/h
 *   1 W = 1/3517.2 TR
 *
 * Uso:
 *   <CapacityDisplay watts={5000} />
 *   <CapacityDisplay watts={5000} compact />
 *   <CapacityDisplay watts={5000} primary="kcal/h" />
 *   <CapacityDisplay watts={5000} inline />
 *
 * Referência: ASHRAE Handbook Fundamentals 2021, Apêndice A — Conversion Factors
 */
import { Badge } from "@/components/ui/badge";

// ── Conversão ─────────────────────────────────────────────────────────────────

export type CapacityUnit = "W" | "kW" | "kcal/h" | "BTU/h" | "TR";

const FACTORS: Record<CapacityUnit, number> = {
  W: 1,
  kW: 0.001,
  "kcal/h": 0.86,
  "BTU/h": 3.41214,
  TR: 1 / 3517.2,
};

const DECIMALS: Record<CapacityUnit, number> = {
  W: 0,
  kW: 2,
  "kcal/h": 0,
  "BTU/h": 0,
  TR: 3,
};

export function convertCapacity(watts: number, unit: CapacityUnit): number {
  return watts * FACTORS[unit];
}

export function fmtCapacity(watts: number, unit: CapacityUnit): string {
  if (!Number.isFinite(watts) || watts === 0) return "—";
  const val = convertCapacity(watts, unit);
  return val.toLocaleString("pt-BR", {
    minimumFractionDigits: DECIMALS[unit],
    maximumFractionDigits: DECIMALS[unit],
  });
}

/** Formata em todas as 4 unidades principais como string de texto (para relatório) */
export function fmtCapacityAll(watts: number): string {
  if (!Number.isFinite(watts) || watts === 0) return "—";
  return [
    `${fmtCapacity(watts, "kW")} kW`,
    `${fmtCapacity(watts, "kcal/h")} kcal/h`,
    `${fmtCapacity(watts, "BTU/h")} BTU/h`,
    `${fmtCapacity(watts, "TR")} TR`,
  ].join(" · ");
}

// ── Componente ────────────────────────────────────────────────────────────────

interface CapacityDisplayProps {
  /** Valor em Watts */
  watts: number | null | undefined;
  /** Unidade principal (exibida em destaque). Padrão: kW */
  primary?: CapacityUnit;
  /** Modo compacto: só exibe a unidade primária + badge com kcal/h */
  compact?: boolean;
  /** Modo inline: todas as unidades numa linha separadas por · */
  inline?: boolean;
  /** Mostrar apenas as unidades especificadas */
  units?: CapacityUnit[];
  className?: string;
}

const DEFAULT_UNITS: CapacityUnit[] = ["kW", "kcal/h", "BTU/h", "TR"];

export function CapacityDisplay({
  watts,
  primary = "kW",
  compact = false,
  inline = false,
  units = DEFAULT_UNITS,
  className = "",
}: CapacityDisplayProps) {
  if (watts == null || !Number.isFinite(watts) || watts === 0) {
    return <span className={`text-slate-400 ${className}`}>—</span>;
  }

  // Modo compacto: valor principal + badge kcal/h
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className="font-semibold tabular-nums">
          {fmtCapacity(watts, primary)} {primary}
        </span>
        {primary !== "kcal/h" && (
          <Badge variant="secondary" className="text-[10px] font-normal tabular-nums">
            {fmtCapacity(watts, "kcal/h")} kcal/h
          </Badge>
        )}
      </span>
    );
  }

  // Modo inline: todas numa linha
  if (inline) {
    return (
      <span className={`tabular-nums text-slate-700 ${className}`}>
        {units.map((u, i) => (
          <span key={u}>
            {i > 0 && <span className="mx-1 text-slate-300">·</span>}
            <span className={u === primary ? "font-semibold text-slate-900" : ""}>
              {fmtCapacity(watts, u)}{" "}
              <span className="text-[11px] text-slate-500">{u}</span>
            </span>
          </span>
        ))}
      </span>
    );
  }

  // Modo padrão: grade com todas as unidades
  return (
    <div className={`grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4 ${className}`}>
      {units.map((u) => (
        <div key={u} className="flex flex-col">
          <span className={`tabular-nums ${u === primary ? "text-base font-bold text-slate-900" : "text-sm font-medium text-slate-700"}`}>
            {fmtCapacity(watts, u)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">{u}</span>
        </div>
      ))}
    </div>
  );
}

/** Versão simplificada para uso em tabelas e cards — linha única com todas as unidades */
export function CapacityRow({
  watts,
  label,
  primary = "kW",
}: {
  watts: number | null | undefined;
  label?: string;
  primary?: CapacityUnit;
}) {
  if (watts == null || !Number.isFinite(watts) || watts === 0) {
    return (
      <div className="flex items-center justify-between py-1">
        {label && <span className="text-xs text-slate-500">{label}</span>}
        <span className="text-xs text-slate-400">—</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1">
      {label && <span className="text-xs font-medium text-slate-600">{label}</span>}
      <div className="flex flex-wrap items-center gap-2">
        {(["kW", "kcal/h", "BTU/h", "TR"] as CapacityUnit[]).map((u) => (
          <span
            key={u}
            className={`text-xs tabular-nums ${u === primary ? "font-bold text-slate-900" : "text-slate-500"}`}
          >
            {fmtCapacity(watts, u)}{" "}
            <span className="text-[10px] text-slate-400">{u}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
