import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  CoilTechnicalBaseInput,
  CondenserTechnicalInput,
  EvaporatorTechnicalInput,
} from "@/modules/thermalcalc/types/coilSimulatorTypes";

type CoilType = "evaporator" | "condenser";

interface CoilTechnicalFormProps {
  coilType: CoilType;
  value: Partial<EvaporatorTechnicalInput | CondenserTechnicalInput>;
  importForm?: React.ReactNode;
  calibrationSlot?: React.ReactNode;
  children?: React.ReactNode;
}

const LABELS = {
  evaporator: {
    title: "Dados técnicos do evaporador",
    mode: "Evaporador DX",
    capacity: "Capacidade frigorífica",
    refTemp: "Temperatura de evaporação",
    approach: "Superaquecimento",
    airIn: "Ar entrada",
  },
  condenser: {
    title: "Dados técnicos do condensador",
    mode: "Condensador",
    capacity: "Rejeição de calor",
    refTemp: "Temperatura de condensação",
    approach: "Subresfriamento",
    airIn: "Ar ambiente",
  },
} as const;

export function CoilTechnicalForm({
  coilType,
  value,
  importForm,
  calibrationSlot,
  children,
}: CoilTechnicalFormProps) {
  const labels = LABELS[coilType];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>{labels.title}</span>
          <Badge variant="outline">{labels.mode}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="general">Dados gerais</TabsTrigger>
            <TabsTrigger value="geometry">Geometria</TabsTrigger>
            <TabsTrigger value="air">Lado do ar</TabsTrigger>
            <TabsTrigger value="refrigerant">Lado refrigerante</TabsTrigger>
            <TabsTrigger value="datasheet">Datasheet</TabsTrigger>
            <TabsTrigger value="calibration">Calibração</TabsTrigger>
            <TabsTrigger value="result">Resultado</TabsTrigger>
            <TabsTrigger value="debug">Debug técnico</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <Grid>
              <Info label="Fabricante">{value.manufacturer ?? "—"}</Info>
              <Info label="Modelo">{value.model ?? "—"}</Info>
              <Info label="Código">{value.code ?? "—"}</Info>
              <Info label="Refrigerante">{value.refrigerant ?? "—"}</Info>
            </Grid>
          </TabsContent>

          <TabsContent value="geometry" className="mt-4">
            <Grid>
              <Info label="Tubos por fila">{value.geometry?.tubesPerRow ?? "—"}</Info>
              <Info label="Filas">{value.geometry?.rows ?? "—"}</Info>
              <Info label="Circuitos">{value.geometry?.circuits ?? "—"}</Info>
              <Info label="Comprimento">{formatNumber(value.dimensions?.lengthMm, "mm")}</Info>
              <Info label="Área">{formatNumber(value.areaM2, "m²")}</Info>
              <Info label="Volume">{formatNumber(value.volumeL, "L")}</Info>
            </Grid>
          </TabsContent>

          <TabsContent value="air" className="mt-4">
            <Grid>
              <Info label="Vazão de ar">{formatNumber(value.airflowM3h, "m³/h")}</Info>
              <Info label={labels.airIn}>{formatNumber(readAirIn(coilType, value), "°C")}</Info>
              <Info label="Ar saída">{formatNumber(readAirOut(value), "°C")}</Info>
            </Grid>
          </TabsContent>

          <TabsContent value="refrigerant" className="mt-4">
            <Grid>
              <Info label={labels.refTemp}>
                {formatNumber(readReferenceTemp(coilType, value), "°C")}
              </Info>
              <Info label={labels.approach}>
                {formatNumber(readApproach(coilType, value), "K")}
              </Info>
              <Info label={labels.capacity}>
                {formatNumber(readCapacity(coilType, value), "W")}
              </Info>
            </Grid>
          </TabsContent>

          <TabsContent value="datasheet" className="mt-4">
            <Grid>
              <Info label="Arquivo datasheet">{value.datasheetFileId ?? "—"}</Info>
              <Info label="Capacidade nominal">{formatNumber(value.nominalCapacityW, "W")}</Info>
              {importForm && <div className="sm:col-span-2">{importForm}</div>}
            </Grid>
          </TabsContent>

          <TabsContent value="calibration" className="mt-4">
            {calibrationSlot ?? children}
          </TabsContent>

          <TabsContent value="result" className="mt-4">
            <p className="text-sm text-muted-foreground">
              Resultado calculado aparece nos painéis de calibração e mapa de performance.
            </p>
          </TabsContent>

          <TabsContent value="debug" className="mt-4">
            <p className="text-sm text-muted-foreground">
              Debug técnico usa o mesmo layout para ambos os coils; o engine permanece específico
              por tipo.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function readReferenceTemp(
  coilType: CoilType,
  value: Partial<EvaporatorTechnicalInput | CondenserTechnicalInput>,
) {
  return coilType === "evaporator"
    ? (value as Partial<EvaporatorTechnicalInput>).evaporationTempC
    : (value as Partial<CondenserTechnicalInput>).condensationTempC;
}

function readApproach(
  coilType: CoilType,
  value: Partial<EvaporatorTechnicalInput | CondenserTechnicalInput>,
) {
  return coilType === "evaporator"
    ? (value as Partial<EvaporatorTechnicalInput>).superheatK
    : (value as Partial<CondenserTechnicalInput>).subcoolingK;
}

function readAirIn(
  coilType: CoilType,
  value: Partial<EvaporatorTechnicalInput | CondenserTechnicalInput>,
) {
  return coilType === "evaporator"
    ? (value as Partial<EvaporatorTechnicalInput>).airInletTempC
    : (value as Partial<CondenserTechnicalInput>).ambientAirTempC;
}

function readAirOut(value: Partial<EvaporatorTechnicalInput | CondenserTechnicalInput>) {
  return (value as Partial<EvaporatorTechnicalInput | CondenserTechnicalInput>).airOutletTempC;
}

function readCapacity(
  coilType: CoilType,
  value: Partial<EvaporatorTechnicalInput | CondenserTechnicalInput>,
) {
  return coilType === "evaporator"
    ? (value as Partial<EvaporatorTechnicalInput>).evaporatorCapacityW
    : (value as Partial<CondenserTechnicalInput>).heatRejectionW;
}

function formatNumber(value: number | null | undefined, unit: string) {
  return value == null ? "—" : `${value} ${unit}`;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

export type { CoilTechnicalBaseInput, EvaporatorTechnicalInput, CondenserTechnicalInput };
