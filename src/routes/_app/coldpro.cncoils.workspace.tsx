import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { CnCoilsWorkspacePage } from "@/modules/cn_coils/pages/CnCoilsWorkspacePage";
import { CondenserWorkspacePage } from "@/modules/cn_coils/pages/CondenserWorkspacePage";
import { CompressorWorkspacePage } from "@/modules/cn_coils/pages/CompressorWorkspacePage";

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
  return <CnCoilsWorkspacePage />;
}
