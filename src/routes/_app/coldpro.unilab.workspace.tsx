import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/coldpro/unilab/workspace")({
  beforeLoad: () => {
    throw redirect({ to: "/coldpro/cncoils/workspace" });
  },
});
