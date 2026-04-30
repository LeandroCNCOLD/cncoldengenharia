/**
 * Stub do CalibrationPanel.
 *
 * O painel original dependia do pipeline do Catálogo CN / Catálogo 480, que foi
 * removido. Esse stub mantém a assinatura original para que evaporator-tab e
 * condenser-tab continuem compilando até que uma nova implementação seja feita.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface CalibrationPanelProps {
  componentItemId: string;
  coilType: "evaporator" | "condenser";
  datasheet: unknown;
  simulationInput: unknown;
}

export function CalibrationPanel(_props: CalibrationPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calibração (indisponível)</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        O módulo de calibração foi desativado junto com a remoção do Catálogo
        480 / pipeline CN. Será reconstruído em uma próxima iteração.
      </CardContent>
    </Card>
  );
}
