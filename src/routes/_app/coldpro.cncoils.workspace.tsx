import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { CnCoilsWorkspacePage } from "@/modules/cn_coils/pages/CnCoilsWorkspacePage";
import { EvaporatorUnifiedWorkspacePage } from "@/modules/cn_coils/pages/EvaporatorUnifiedWorkspacePage";
import { CondenserWorkspacePage } from "@/modules/cn_coils/pages/CondenserWorkspacePage";
import { CompressorWorkspacePage } from "@/modules/cn_coils/pages/CompressorWorkspacePage";
import { EvaporativeCondenserWorkspacePage } from "@/modules/cn_coils/pages/EvaporativeCondenserWorkspacePage";
import { HeatingCoilWorkspacePage } from "@/modules/cn_coils/pages/HeatingCoilWorkspacePage";
import { WaterCondenserWorkspacePage } from "@/modules/cn_coils/pages/WaterCondenserWorkspacePage";

// Tipos canônicos aceitos pelo workspace.
const CANONICAL_TYPES = [
  "evaporator_dx",
  "evaporator_pumped",
  "condenser_air",
  "condenser_shell_tube",
  "heating_coil",
  "cooling_coil",
  "defrost_steam_coil",
  "recuperator",
  "shell_tube",
  "chiller_unit",
  "compressor",
  "evaporative_condenser",
  "water_condenser",
  // alias: redireciona para /coldpro/assembly
  "assembly",
] as const;

// Aliases curtos -> tipo canônico.
const TYPE_ALIASES: Record<string, (typeof CANONICAL_TYPES)[number]> = {
  evaporator: "evaporator_dx",
  condenser: "condenser_air",
  evap_cond: "evaporative_condenser",
  water_cond: "water_condenser",
  heating: "heating_coil",
  cooling: "cooling_coil",
};

const searchSchema = z.object({
  // fallback() evita "Something went wrong" quando o tipo não é reconhecido.
  type: fallback(z.enum(CANONICAL_TYPES), "evaporator_dx" as const).optional(),
});

export const Route = createFileRoute("/_app/coldpro/cncoils/workspace")({
  validateSearch: zodValidator(searchSchema),
  component: CnCoilsWorkspaceRoute,
});

function CnCoilsWorkspaceRoute() {
  const search = Route.useSearch();

  // Bancada vive em /coldpro/assembly — redireciona o alias.
  if (search.type === "assembly") {
    return <Navigate to="/coldpro/assembly" replace />;
  }

  // Resolve aliases curtos para o tipo canônico.
  const resolved =
    (search.type && TYPE_ALIASES[search.type as string]) ?? search.type;

  if (resolved === "evaporator_dx" || resolved === "evaporator_pumped") return <EvaporatorUnifiedWorkspacePage />;
  if (resolved === "condenser_air") return <CondenserWorkspacePage />;
  if (resolved === "compressor") return <CompressorWorkspacePage />;
  if (resolved === "evaporative_condenser") return <EvaporativeCondenserWorkspacePage />;
  if (resolved === "water_condenser") return <WaterCondenserWorkspacePage />;
  if (resolved === "heating_coil") return <HeatingCoilWorkspacePage />;
  // Tipos sem workspace dedicado ainda (cooling_coil, defrost_steam_coil, recuperator, shell_tube, chiller_unit)
  return <CnCoilsWorkspacePage />;
}
