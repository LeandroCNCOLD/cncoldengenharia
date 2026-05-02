import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/modules/coldpro/components/layout/AppShell";

export const Route = createFileRoute("/_app/coldpro")({
  component: AppShell,
});
