import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { CnCoilsWorkspacePage } from "@/modules/cn_coils/pages/CnCoilsWorkspacePage";

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
    ])
    .optional(),
});

export const Route = createFileRoute("/_app/coldpro/cn-coils/workspace")({
  validateSearch: zodValidator(searchSchema),
  component: CnCoilsWorkspacePage,
});
