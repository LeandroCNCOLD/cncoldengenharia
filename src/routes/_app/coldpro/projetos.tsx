import { createFileRoute } from "@tanstack/react-router";
import { EquipmentListPage } from "@/components/coldpro/equipment-list-page";

export const Route = createFileRoute("/_app/coldpro/projetos")({
  component: EquipmentListPage,
});
