import { createFileRoute } from "@tanstack/react-router";
import { SystemCyclePage } from "@/modules/cn_coils/pages/systems/SystemCyclePage";

export const Route = createFileRoute("/_app/coldpro/cncoils/systems/cold-room")({
  component: () => <SystemCyclePage mode="cold-room" />,
});
