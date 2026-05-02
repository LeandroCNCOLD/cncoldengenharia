import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/coldpro/unilab/workspace")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/coldpro/cn-coils/workspace",
      search,
      replace: true,
    });
  },
});
