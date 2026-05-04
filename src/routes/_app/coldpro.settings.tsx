import { createFileRoute } from "@tanstack/react-router";
import SettingsPage from "@/modules/coldpro/pages/SettingsPage";

export const Route = createFileRoute("/_app/coldpro/settings")({
  component: SettingsPage,
});
