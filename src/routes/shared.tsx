import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { SharedProjectPage } from "@/modules/cn_coils/pages/SharedProjectPage";

const searchSchema = z.object({
  p: fallback(z.string(), "").optional(),
});

export const Route = createFileRoute("/shared")({
  validateSearch: zodValidator(searchSchema),
  component: SharedRoute,
});

function SharedRoute() {
  const { p } = Route.useSearch();
  return <SharedProjectPage token={p ?? ""} />;
}
