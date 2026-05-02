import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/coldpro/unilab")({
  beforeLoad: () => {
    throw redirect({ to: "/coldpro/cn-coils" });
  },
});
