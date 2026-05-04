import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { CnCoilsWorkspacePage } from "@/modules/cn_coils/pages/CnCoilsWorkspacePage";
import { CondenserWorkspacePage } from "@/modules/cn_coils/pages/CondenserWorkspacePage";
import { CompressorWorkspacePage } from "@/modules/cn_coils/pages/CompressorWorkspacePage";
import { EvaporativeCondenserWorkspacePage } from "@/modules/cn_coils/pages/EvaporativeCondenserWorkspacePage";
import { HeatingCoilWorkspacePage } from "@/modules/cn_coils/pages/HeatingCoilWorkspacePage";
import { WaterCondenserWorkspacePage } from "@/modules/cn_coils/pages/WaterCondenserWorkspacePage";

const searchSchema = z.object({
  type: z
    .enum([
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
    ])
    .optional(),
});

export const Route = createFileRoute("/_app/coldpro/cncoils/workspace")({
  validateSearch: zodValidator(searchSchema),
  component: CnCoilsWorkspaceRoute,
});

function CnCoilsWorkspaceRoute() {
  const search = Route.useSearch();
  if (search.type === "condenser_air") return <CondenserWorkspacePage />;
  if (search.type === "compressor") return <CompressorWorkspacePage />;
  if (search.type === "evaporative_condenser") return <EvaporativeCondenserWorkspacePage />;
  if (search.type === "water_condenser") return <WaterCondenserWorkspacePage />;
  if (search.type === "heating_coil") return <HeatingCoilWorkspacePage />;
  return <CnCoilsWorkspacePage />;
}
