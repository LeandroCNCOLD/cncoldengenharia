import { createFileRoute } from "@tanstack/react-router";
import LibraryPage from "@/modules/coldpro/pages/LibraryPage";

export const Route = createFileRoute("/_app/coldpro/library")({
  component: LibraryPage,
});
