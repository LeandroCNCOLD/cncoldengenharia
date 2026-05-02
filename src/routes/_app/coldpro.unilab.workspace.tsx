import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { UnilabWorkspacePage } from "@/modules/unilab_simulator/pages/UnilabWorkspacePage";

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

export const Route = createFileRoute("/_app/coldpro/unilab/workspace")({
  validateSearch: zodValidator(searchSchema),
  component: UnilabWorkspacePage,
});
