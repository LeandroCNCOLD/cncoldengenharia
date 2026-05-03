import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Calculator, Loader2, Send, Waves, Flame } from "lucide-react";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import { useUnilabCatalogs } from "../../hooks/useUnilabCatalogs";
import { DatasetStatusPanel } from "../../components/DatasetStatusPanel";
import { runSimulation, SimulationError } from "../../engine/simulatorCore";
import {
  toEvaporatorInput,
  toReheatCoilInput,
} from "../../adapters/toColdProAdapter";
import { useComponentStore } from "@/modules/coldpro/stores/useComponentStore";
import type {
  UnilabPhysicalInputs,
  UnilabSimulationResult,
  UnilabThermoInputs,
} from "../../types/unilab.types";

// ---------- Defaults físicos compactos para cada coil ----------
const DEFAULT_PHYSICAL: UnilabPhysicalInputs = {
  componentType: "evaporator_dx",
  geometryId: "",
  finnedHeightMm: 600,
  finnedLengthMm: 800,
  rows: 4,
  circuits: 6,
  tubeMaterialId: "",
  finPitchMm: 2.5,
  finThicknessMm: 0.15,
  tubePitchTransverseMm: 25,
  tubePitchLongitudinalMm: 21.65,
  tubeOuterDiameterMm: 9.52,
  tubeInnerDiameterMm: 8.92,
};

const DEFAULT_HEATING_PHYSICAL: UnilabPhysicalInputs = {
  ...DEFAULT_PHYSICAL,
  componentType: "heating_coil",
  rows: 2,
  circuits: 4,
  finPitchMm: 3.0,
};

interface AirInlet {
  airFlowM3H: number;
  airInletTempC: number;
  airInletRhPercent: number;
  altitudeM: number;
}

const DEFAULT_AIR: AirInlet = {
  airFlowM3H: 5000,
  airInletTempC: 30,
  airInletRhPercent: 70,
  altitudeM: 0,
};

interface SystemResult {
  evap?: UnilabSimulationResult;
  heating?: UnilabSimulationResult;
  errors: string[];
}

function NumberInput({
  label,
  value,
  onChange,
  unit,
  step = 1,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-700">
      <span className="font-medium">{label}{unit && <span className="ml-1 text-slate-400">({unit})</span>}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : ""}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}

function CoilCard({
  title,
  Icon,
  iconColor,
  children,
}: {
  title: string;
  Icon: typeof Waves;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function DehumidificationSystemPage() {
  const navigate = useNavigate();
  const catalogs = useUnilabCatalogs();

  // ---------- Inputs do AR (somente no evaporador, propagado via cascata) ----------
  const [airInlet, setAirInlet] = useState<AirInlet>(DEFAULT_AIR);

  // ---------- Geometrias e termodinâmica de cada coil ----------
  const [evapPhys, setEvapPhys] = useState<UnilabPhysicalInputs>(DEFAULT_PHYSICAL);
  const [heatPhys, setHeatPhys] = useState<UnilabPhysicalInputs>(DEFAULT_HEATING_PHYSICAL);

  const [evapEvapTempC, setEvapEvapTempC] = useState(5);
  const [heatFluidTempInC, setHeatFluidTempInC] = useState(80);
  const [heatFluidTempOutC, setHeatFluidTempOutC] = useState(60);

  const [refrigerantId, setRefrigerantId] = useState<string>("");

  // Auto-seleciona primeiros itens dos catálogos
  useEffect(() => {
    if (!catalogs.ready) return;
    const firstGeom = catalogs.geometries[0];
    const firstMat = catalogs.tubeMaterials[0];
    const firstRefrig = catalogs.refrigerants[0];
    if (firstGeom && !evapPhys.geometryId) {
      setEvapPhys((p) => ({
        ...p,
        geometryId: firstGeom.id,
        tubePitchTransverseMm: firstGeom.tubePitchTransverseMm,
        tubePitchLongitudinalMm: firstGeom.tubePitchLongitudinalMm,
        tubeOuterDiameterMm: firstGeom.tubeOuterDiameterMm,
        tubeInnerDiameterMm: firstGeom.tubeInnerDiameterMm ?? p.tubeInnerDiameterMm,
      }));
      setHeatPhys((p) => ({
        ...p,
        geometryId: firstGeom.id,
        tubePitchTransverseMm: firstGeom.tubePitchTransverseMm,
        tubePitchLongitudinalMm: firstGeom.tubePitchLongitudinalMm,
        tubeOuterDiameterMm: firstGeom.tubeOuterDiameterMm,
        tubeInnerDiameterMm: firstGeom.tubeInnerDiameterMm ?? p.tubeInnerDiameterMm,
      }));
    }
    if (firstMat && !evapPhys.tubeMaterialId) {
      setEvapPhys((p) => ({ ...p, tubeMaterialId: firstMat.id }));
      setHeatPhys((p) => ({ ...p, tubeMaterialId: firstMat.id }));
    }
    if (firstRefrig && !refrigerantId) setRefrigerantId(firstRefrig.id);
  }, [catalogs.ready, catalogs.geometries, catalogs.tubeMaterials, catalogs.refrigerants, evapPhys.geometryId, evapPhys.tubeMaterialId, refrigerantId]);

  // ---------- Cascata termodinâmica ----------
  const [isCalculating, setIsCalculating] = useState(false);
  const [systemResult, setSystemResult] = useState<SystemResult>({ errors: [] });
  const [sending, setSending] = useState(false);

  const simulationDeps = useMemo(
    () => ({
      correctionCoefficients: catalogs.correctionCoefficients,
      pressureDropFan: catalogs.pressureDropFan,
    }),
    [catalogs.correctionCoefficients, catalogs.pressureDropFan],
  );

  const runSystem = () => {
    if (!catalogs.ready || !refrigerantId) {
      setSystemResult({ errors: ["Catálogos ou refrigerante ausentes."] });
      return;
    }
    setIsCalculating(true);
    try {
      // 1. Evaporador
      const evapTubeMat = catalogs.tubeMaterials.find((m) => m.id === evapPhys.tubeMaterialId);
      if (!evapTubeMat) throw new SimulationError("Material do tubo do evaporador inválido.", []);
      const evapGeom = catalogs.geometries.find((g) => g.id === evapPhys.geometryId);

      const evapThermo: UnilabThermoInputs = {
        refrigerantId,
        airFlowM3H: airInlet.airFlowM3H,
        airInletTempC: airInlet.airInletTempC,
        airInletRhPercent: airInlet.airInletRhPercent,
        altitudeM: airInlet.altitudeM,
        evaporatingTempC: evapEvapTempC,
        superheatK: 5,
      };

      const evapResult = runSimulation({
        physical: evapPhys,
        thermo: evapThermo,
        catalogs: simulationDeps,
        tubeMaterialConductivity: evapTubeMat.conductivityWmK,
        uBaseWm2K: evapGeom?.uBaseWm2K,
      });

      // 2. Cascata: saída do evaporador alimenta o aquecimento
      const heatTubeMat = catalogs.tubeMaterials.find((m) => m.id === heatPhys.tubeMaterialId);
      if (!heatTubeMat) throw new SimulationError("Material do tubo do aquecimento inválido.", []);
      const heatGeom = catalogs.geometries.find((g) => g.id === heatPhys.geometryId);

      const heatFluidMeanC = (heatFluidTempInC + heatFluidTempOutC) / 2;

      const heatThermo: UnilabThermoInputs = {
        refrigerantId: "water",
        airFlowM3H: airInlet.airFlowM3H,
        airInletTempC: evapResult.airOutletTempC,           // CASCATA
        airInletRhPercent: evapResult.airOutletRhPercent,    // CASCATA
        altitudeM: airInlet.altitudeM,
        // Para coil hidrônica usamos T média do fluido como proxy de T_evap
        evaporatingTempC: heatFluidMeanC,
      };

      const heatResult = runSimulation({
        physical: heatPhys,
        thermo: heatThermo,
        catalogs: simulationDeps,
        tubeMaterialConductivity: heatTubeMat.conductivityWmK,
        uBaseWm2K: heatGeom?.uBaseWm2K,
      });

      setSystemResult({ evap: evapResult, heating: heatResult, errors: [] });
    } catch (err) {
      const errors = err instanceof SimulationError ? err.errors : [String(err)];
      setSystemResult({ errors: errors.length ? errors : [String(err)] });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSendToAssembly = () => {
    if (!systemResult.evap || !systemResult.heating) {
      setSystemResult((r) => ({ ...r, errors: ["Calcule o sistema antes de enviar."] }));
      return;
    }
    setSending(true);
    try {
      const ctx = { tubeMaterials: catalogs.tubeMaterials };
      const baseName = `Desumidificador ${new Date().toLocaleString("pt-BR")}`;
      const store = useComponentStore.getState();

      // Spec do evaporador
      const evapThermo: UnilabThermoInputs = {
        refrigerantId,
        airFlowM3H: airInlet.airFlowM3H,
        airInletTempC: airInlet.airInletTempC,
        airInletRhPercent: airInlet.airInletRhPercent,
        altitudeM: airInlet.altitudeM,
        evaporatingTempC: evapEvapTempC,
      };
      const evapSpec = toEvaporatorInput(evapPhys, evapThermo, systemResult.evap, ctx);
      store.addCoil(`${baseName} — Evaporador`, "evaporator", evapSpec);

      // Spec do reaquecimento
      const heatFluidMeanC = (heatFluidTempInC + heatFluidTempOutC) / 2;
      const heatThermo: UnilabThermoInputs = {
        refrigerantId: "water",
        airFlowM3H: airInlet.airFlowM3H,
        airInletTempC: systemResult.evap.airOutletTempC,
        airInletRhPercent: systemResult.evap.airOutletRhPercent,
        altitudeM: airInlet.altitudeM,
        evaporatingTempC: heatFluidMeanC,
      };
      const heatSpec = toReheatCoilInput(
        heatPhys,
        heatThermo,
        systemResult.heating,
        ctx,
        heatFluidMeanC,
      );
      store.addCoil(`${baseName} — Reaquecimento`, "reheat", heatSpec);

      navigate({ to: "/coldpro/components" });
    } catch (err) {
      setSystemResult((r) => ({
        ...r,
        errors: [err instanceof Error ? err.message : String(err)],
      }));
    } finally {
      setSending(false);
    }
  };

  const evap = systemResult.evap;
  const heating = systemResult.heating;
  // Água condensada: latente em kW → kg/h (h_lv ≈ 2450 kJ/kg)
  const condensedWaterKgH = evap
    ? (evap.latentCapacityKw * 3600) / 2450
    : 0;

  return (
    <PageContainer
      title="Sistema — Desumidificação"
      subtitle="Mundo 2 · Evaporador + Reaquecimento em cascata termodinâmica"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/coldpro/unilab"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <button
            type="button"
            onClick={runSystem}
            disabled={!catalogs.ready || isCalculating}
            className="inline-flex items-center gap-2 rounded-md bg-[#1E6FD9] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1758ad] disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isCalculating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4" />
            )}
            Calcular Sistema
          </button>
          <button
            type="button"
            onClick={handleSendToAssembly}
            disabled={!evap || !heating || sending}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Send className="h-4 w-4" />
            Enviar Sistema para Montagem
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <DatasetStatusPanel
          loading={catalogs.loading}
          ready={catalogs.ready}
          errors={catalogs.errors}
          missing={catalogs.missing}
          compact
        />

        {/* Painel de resumo do sistema */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm md:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Capacidade Resfriamento</div>
            <div className="text-lg font-semibold text-blue-700">
              {evap ? `${evap.totalCapacityKw.toFixed(2)} kW` : "—"}
            </div>
            {evap && (
              <div className="text-xs text-slate-500">SHF {evap.shf.toFixed(2)} · {evap.regime}</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Água Condensada</div>
            <div className="text-lg font-semibold text-cyan-700">
              {evap ? `${condensedWaterKgH.toFixed(2)} kg/h` : "—"}
            </div>
            {evap && (
              <div className="text-xs text-slate-500">Latente {evap.latentCapacityKw.toFixed(2)} kW</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Capacidade Reaquecimento</div>
            <div className="text-lg font-semibold text-orange-700">
              {heating ? `${heating.totalCapacityKw.toFixed(2)} kW` : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Ar Tratado Final</div>
            <div className="text-lg font-semibold text-slate-900">
              {heating
                ? `${heating.airOutletTempC.toFixed(1)} °C / ${heating.airOutletRhPercent.toFixed(0)}% UR`
                : "—"}
            </div>
          </div>
        </div>

        {systemResult.errors.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <strong>Erros:</strong>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {systemResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Workspaces lado a lado */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* LADO ESQUERDO — Evaporador */}
          <CoilCard title="Evaporador DX (Resfriamento + Desumidificação)" Icon={Waves} iconColor="bg-blue-100 text-blue-700">
            <div className="space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-slate-500">Ar de Entrada</legend>
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput label="Vazão de ar" unit="m³/h" value={airInlet.airFlowM3H} onChange={(v) => setAirInlet((s) => ({ ...s, airFlowM3H: v }))} />
                  <NumberInput label="Temp. DB entrada" unit="°C" value={airInlet.airInletTempC} step={0.1} onChange={(v) => setAirInlet((s) => ({ ...s, airInletTempC: v }))} />
                  <NumberInput label="UR entrada" unit="%" value={airInlet.airInletRhPercent} step={1} onChange={(v) => setAirInlet((s) => ({ ...s, airInletRhPercent: v }))} />
                  <NumberInput label="Altitude" unit="m" value={airInlet.altitudeM} onChange={(v) => setAirInlet((s) => ({ ...s, altitudeM: v }))} />
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-slate-500">Refrigerante</legend>
                <select
                  value={refrigerantId}
                  onChange={(e) => setRefrigerantId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  {catalogs.refrigerants.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <NumberInput label="T_evaporação" unit="°C" value={evapEvapTempC} step={0.5} onChange={setEvapEvapTempC} />
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-slate-500">Geometria</legend>
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput label="Altura aletada" unit="mm" value={evapPhys.finnedHeightMm} onChange={(v) => setEvapPhys((p) => ({ ...p, finnedHeightMm: v }))} />
                  <NumberInput label="Comprimento aletado" unit="mm" value={evapPhys.finnedLengthMm} onChange={(v) => setEvapPhys((p) => ({ ...p, finnedLengthMm: v }))} />
                  <NumberInput label="Fileiras" value={evapPhys.rows} onChange={(v) => setEvapPhys((p) => ({ ...p, rows: v }))} />
                  <NumberInput label="Circuitos" value={evapPhys.circuits} onChange={(v) => setEvapPhys((p) => ({ ...p, circuits: v }))} />
                  <NumberInput label="Passo aleta" unit="mm" value={evapPhys.finPitchMm} step={0.1} onChange={(v) => setEvapPhys((p) => ({ ...p, finPitchMm: v }))} />
                </div>
              </fieldset>

              {evap && (
                <div className="rounded-md border border-blue-100 bg-blue-50 p-2 text-xs text-blue-900">
                  Saída do ar: <strong>{evap.airOutletTempC.toFixed(1)}°C</strong> / <strong>{evap.airOutletRhPercent.toFixed(0)}% UR</strong>
                </div>
              )}
            </div>
          </CoilCard>

          {/* LADO DIREITO — Aquecimento */}
          <CoilCard title="Bateria de Reaquecimento (Sensível)" Icon={Flame} iconColor="bg-orange-100 text-orange-700">
            <div className="space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-slate-500">Ar de Entrada (cascata do evaporador)</legend>
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput label="Vazão de ar" unit="m³/h" value={airInlet.airFlowM3H} onChange={() => {}} disabled />
                  <NumberInput label="Temp. DB" unit="°C" value={evap?.airOutletTempC ?? 0} onChange={() => {}} disabled />
                  <NumberInput label="UR" unit="%" value={evap?.airOutletRhPercent ?? 0} onChange={() => {}} disabled />
                </div>
                <p className="text-[11px] text-slate-500">Read-only: sai do evaporador automaticamente.</p>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-slate-500">Fluido Aquecedor (água)</legend>
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput label="T_entrada fluido" unit="°C" value={heatFluidTempInC} step={1} onChange={setHeatFluidTempInC} />
                  <NumberInput label="T_saída fluido" unit="°C" value={heatFluidTempOutC} step={1} onChange={setHeatFluidTempOutC} />
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-slate-500">Geometria</legend>
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput label="Altura aletada" unit="mm" value={heatPhys.finnedHeightMm} onChange={(v) => setHeatPhys((p) => ({ ...p, finnedHeightMm: v }))} />
                  <NumberInput label="Comprimento aletado" unit="mm" value={heatPhys.finnedLengthMm} onChange={(v) => setHeatPhys((p) => ({ ...p, finnedLengthMm: v }))} />
                  <NumberInput label="Fileiras" value={heatPhys.rows} onChange={(v) => setHeatPhys((p) => ({ ...p, rows: v }))} />
                  <NumberInput label="Circuitos" value={heatPhys.circuits} onChange={(v) => setHeatPhys((p) => ({ ...p, circuits: v }))} />
                  <NumberInput label="Passo aleta" unit="mm" value={heatPhys.finPitchMm} step={0.1} onChange={(v) => setHeatPhys((p) => ({ ...p, finPitchMm: v }))} />
                </div>
              </fieldset>

              {heating && (
                <div className="rounded-md border border-orange-100 bg-orange-50 p-2 text-xs text-orange-900">
                  Saída do ar: <strong>{heating.airOutletTempC.toFixed(1)}°C</strong> / <strong>{heating.airOutletRhPercent.toFixed(0)}% UR</strong>
                </div>
              )}
            </div>
          </CoilCard>
        </div>
      </div>
    </PageContainer>
  );
}
