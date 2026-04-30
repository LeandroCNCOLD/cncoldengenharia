/**
 * Card resumo do Catálogo CN COLD com botão de upload do CSV.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LineChart } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CatalogUploadButton } from "@/components/coldpro/catalog-upload-button";
import { countCatalogCurves } from "@/lib/coldpro/catalog-curves";

export function CatalogCnColdCard() {
  const qc = useQueryClient();
  const { data: total } = useQuery({
    queryKey: ["cn-catalog-count"],
    queryFn: countCatalogCurves,
  });

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <LineChart className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Catálogo CN COLD (curvas reais)</p>
            <p className="text-xs text-muted-foreground">
              Referência de validação · não substitui compressores/coils/fans.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{total ?? 0} curva(s)</Badge>
          <CatalogUploadButton onDone={() => qc.invalidateQueries({ queryKey: ["cn-catalog-count"] })} />
        </div>
      </CardContent>
    </Card>
  );
}
