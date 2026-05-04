import { createFileRoute } from "@tanstack/react-router";
import { ComponentLibraryPage } from "@/modules/cn_coils/pages/ComponentLibraryPage";

export const Route = createFileRoute("/_app/coldpro/cncoils/component-library")({
  component: ComponentLibraryPage,
});
