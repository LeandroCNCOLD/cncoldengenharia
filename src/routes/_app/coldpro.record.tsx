import { createFileRoute } from "@tanstack/react-router";
import { ProductRecordPage } from "@/modules/coldpro/pages/ProductRecordPage";

export const Route = createFileRoute("/_app/coldpro/record")({
  component: ProductRecordPage,
});
