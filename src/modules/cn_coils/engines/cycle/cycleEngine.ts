/**
 * CycleEngine v1 — solver de ciclo de refrigeração simples.
 *
 * Conecta compressorModel + coilCycleAdapter + refrigerantProperties usando
 * ponto fixo com relaxação. Não altera os motores de serpentina existentes.
 */
import { evaluateCompressor } from "../compressor/compressorModel";
import { runCoilForCycle } from "../coil/coilCycleAdapter";
import { evaluateExpansionDevice } from "../expansion/expansionEngine";
import { getRefrigerantSatProps } from "../refrigerant/refrigerantProperties";
import type {
  CycleResult,
  CycleStatePoint,
  CycleSystemConfig,
  CycleThermoConfig,
  CycleThermoResult,
} from "./cycleTypes";
import { runAssemblySimulation } from "../assembly/coilAssembly";
import type { CoilAssemblyConfig } from "../assembly/assemblyTypes";
import type { CycleExpansionDeviceConfig } from "./cycleTypes";

function buildStatePoint(
  T_C: number,
  P_kPa: number,
  h_kJkg: number,
  s_kJkgK: number,
  quality: number,
): CycleStatePoint {
  let phase: CycleStatePoint["phase"];
  if (quality < 0) phase = "subcooled";
  else if (quality > 1) phase = "superheated";
  else if (quality === 0) phase = "liquid";
  else if (quality === 1) phase = "vapor";
  else phase = "two_phase";
  return { T_C, P_kPa, h_kJkg, s_kJkgK, quality, phase };
}

function normalizeWarning(warning: string): string {
  return warning.replace(/\d+\.\d+/g, "X");
}

function pushUnique(target: string[], source: string[]): void {
  for (const warning of source) {
    const normalized = normalizeWarning(warning);
    if (!target.some((existing) => normalizeWarning(existing) === normalized)) {
      target.push(warning);
    }
  }
}

function normalizeExpansionConfig(device: CycleExpansionDeviceConfig) {
  const full = device as {
    mode?: "disabled" | "passive" | "active";
    device?: import("../expansion/expansionTypes").ExpansionDeviceConfig;
    subcoolingK?: number;
    actualSuperheatK?: number;
  };
  return {
    mode: full.mode ?? "disabled",
    device: full.device,
    subcoolingK: full.subcoolingK,
    actualSuperheatK: full.actualSuperheatK,
  };
}

export async function runCycleThermo(
  config: CycleThermoConfig,
): Promise<CycleThermoResult> {
  const [satEvap, satCond] = await Promise.all([
    getRefrigerantSatProps(config.refrigerantId, config.Te_C),
    getRefrigerantSatProps(config.refrigerantId, config.Tc_C),
  ]);
  const warnings = [...satEvap.warnings, ...satCond.warnings];
  const h1 = satEvap.h_g_kJkg + satEvap.vapor.cp_kJkgK * config.superheatK;
  const compressionRatio = satEvap.P_kPa > 0 ? satCond.P_kPa / satEvap.P_kPa : 1;
  const gamma = 1.15;
  const t1K = config.Te_C + config.superheatK + 273.15;
  const t2isK = t1K * Math.pow(compressionRatio, (gamma - 1) / gamma);
  const etaIs = 0.7;
  const deltaTCompK = Math.max(0, (t2isK - t1K) / etaIs);
  const h2 = h1 + satEvap.vapor.cp_kJkgK * deltaTCompK;
  const h3 = satCond.h_f_kJkg - satCond.liquid.cp_kJkgK * config.subcoolingK;
  const h4 = h3;
  const qEvap = Math.max(0, h1 - h4);
  const wComp = Math.max(0, h2 - h1);
  const qCond = qEvap + wComp;
  const COP = wComp > 0 ? qEvap / wComp : 0;

  return {
    Te_C: config.Te_C,
    Tc_C: config.Tc_C,
    h1_kJkg: h1,
    h2_kJkg: h2,
    h3_kJkg: h3,
    h4_kJkg: h4,
    qEvap_kJkg: qEvap,
    wComp_kJkg: wComp,
    qCond_kJkg: qCond,
    COP,
    EER: COP * 3.41214,
    warnings,
  };
}

export async function runCycleSimulation(config: CycleSystemConfig): Promise<CycleResult> {
  const warnings: string[] = [];
  const tol = config.solver?.tolerance ?? 0.01;
  const maxIter = config.solver?.maxIterations ?? 30;
  const omega = config.solver?.relaxation ?? 0.4;

  let Te = config.solver?.Te_initial_C ?? -10;
  let Tc = config.solver?.Tc_initial_C ?? 40;
  const expansionConfig = normalizeExpansionConfig(config.expansionDevice);
  const superheatK =
    (expansionConfig.device?.type === "txv" || expansionConfig.device?.type === "eev"
      ? expansionConfig.device.superheatTargetK
      : config.expansionDevice.superheatTarget_K) ?? 5;
  const subcoolingK = expansionConfig.subcoolingK ?? 5;

  let converged = false;
  let iterations = 0;
  let residual = Number.POSITIVE_INFINITY;

  let lastCompResult: Awaited<ReturnType<typeof evaluateCompressor>> | null = null;
  let lastEvapResult: Awaited<ReturnType<typeof runCoilForCycle>> | null = null;
  let lastCondResult: Awaited<ReturnType<typeof runCoilForCycle>> | null = null;
  let lastExpansionResult: Awaited<ReturnType<typeof evaluateExpansionDevice>> | null = null;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;

    const compResult = await evaluateCompressor(
      {
        Te_C: Te,
        Tc_C: Tc,
        superheat_K: superheatK,
        subcooling_K: subcoolingK,
        refrigerantId: config.refrigerantId,
      },
      config.compressor,
    );
    pushUnique(warnings, compResult.warnings);
    lastCompResult = compResult;

    if (compResult.Q_evap_W <= 0) {
      warnings.push(
        `Iteração ${iter + 1}: compressor retornou Q_evap ≤ 0. Verificar Te=${Te.toFixed(1)}°C, Tc=${Tc.toFixed(1)}°C.`,
      );
      break;
    }

    let mDot = compResult.m_dot_kgS;
    const expansionMode = expansionConfig.mode;
    const expansionDevice = expansionConfig.device;
    const expansionSubcoolingK = expansionConfig.subcoolingK ?? subcoolingK;
    const expansionActualSuperheatK = expansionConfig.actualSuperheatK ?? superheatK;
    const expansionResult = await evaluateExpansionDevice({
      mode: expansionMode,
      device: expansionDevice,
      evaporatingTempC: Te,
      condensingTempC: Tc,
      subcoolingK: expansionSubcoolingK,
      actualSuperheatK: expansionActualSuperheatK,
      refrigerantId: config.refrigerantId,
    });
    pushUnique(warnings, expansionResult.warnings);
    lastExpansionResult = expansionResult;

    if (expansionResult.mode === "active" && expansionResult.massFlowKgS !== null) {
      mDot = Math.min(mDot, expansionResult.massFlowKgS);
    }

    const evapResult = await runCoilForCycle({
      ...config.evaporator,
      refrigerantId: config.refrigerantId,
      evaporatingTempC: Te,
      superheatK,
      subcoolingK,
      refrigerantMassFlowKgS: mDot,
      componentType: "evaporator",
    });
    pushUnique(warnings, evapResult.warnings);
    lastEvapResult = evapResult;

    const condResult = await runCoilForCycle({
      ...config.condenser,
      refrigerantId: config.refrigerantId,
      condensingTempC: Tc,
      superheatK: 0,
      subcoolingK,
      refrigerantMassFlowKgS: mDot,
      componentType: "condenser",
    });
    pushUnique(warnings, condResult.warnings);
    lastCondResult = condResult;

    const rEvap =
      (compResult.Q_evap_W - evapResult.totalCapacityW) / compResult.Q_evap_W;
    const rCond =
      (compResult.Q_cond_W - condResult.totalCapacityW) / compResult.Q_cond_W;
    residual = Math.max(Math.abs(rEvap), Math.abs(rCond));

    if (residual < tol) {
      converged = true;
      break;
    }

    Te = Te + omega * rEvap * 5.0;
    Tc = Tc + omega * rCond * 5.0;

    Te = Math.max(-50, Math.min(20, Te));
    Tc = Math.max(20, Math.min(70, Tc));
    if (Te >= Tc - 5) {
      Te = Tc - 10;
      warnings.push(
        `Iteração ${iter + 1}: Te ajustado para ${Te.toFixed(1)}°C para manter Te < Tc − 5°C.`,
      );
    }
  }

  if (!converged) {
    warnings.push(
      `CycleEngine não convergiu em ${maxIter} iterações. ` +
        `Resíduo final: ${(residual * 100).toFixed(1)}%. ` +
        "Resultado é uma estimativa. Verifique as condições de projeto.",
    );
  }

  const QEvapW = lastEvapResult?.totalCapacityW ?? lastCompResult?.Q_evap_W ?? 0;
  const WCompW = lastCompResult?.W_comp_W ?? 0;
  // O total do ciclo deve respeitar o balanço do compressor; o resultado do
  // condensador segue disponível em condenserResult para análise de capacidade.
  const QCondW = (lastCompResult?.Q_cond_W ?? QEvapW + WCompW);
  const mDot = lastCompResult?.m_dot_kgS ?? 0;
  const COP = WCompW > 0 ? QEvapW / WCompW : 0;
  const EER = COP * 3.41214;

  const [satEvap, satCond] = await Promise.all([
    getRefrigerantSatProps(config.refrigerantId, Te),
    getRefrigerantSatProps(config.refrigerantId, Tc),
  ]);

  const h1 = satEvap.h_g_kJkg + satEvap.vapor.cp_kJkgK * superheatK;
  const point1 = buildStatePoint(
    Te + superheatK,
    satEvap.P_kPa,
    h1,
    satEvap.s_g_kJkgK,
    1.0 + superheatK / 100,
  );

  const compressionRatio = satEvap.P_kPa > 0 ? satCond.P_kPa / satEvap.P_kPa : 1;
  const gamma = 1.15;
  const T2is =
    (Te + superheatK + 273.15) *
      Math.pow(compressionRatio, (gamma - 1) / gamma) -
    273.15;
  const etaIs = 0.70;
  const T2 = Te + superheatK + (T2is - Te - superheatK) / etaIs;
  const h2 = h1 + (WCompW / 1000) / (mDot > 0 ? mDot : 1);
  const point2 = buildStatePoint(
    T2,
    satCond.P_kPa,
    h2,
    satCond.s_g_kJkgK,
    1.0 + (T2 - Tc) / 100,
  );

  const h3 = satCond.h_f_kJkg - satCond.liquid.cp_kJkgK * subcoolingK;
  const point3 = buildStatePoint(
    Tc - subcoolingK,
    satCond.P_kPa,
    h3,
    satCond.s_f_kJkgK,
    -subcoolingK / 100,
  );

  const h4 = h3;
  const quality4 =
    satEvap.h_fg_kJkg > 0
      ? Math.max(0, Math.min(1, (h4 - satEvap.h_f_kJkg) / satEvap.h_fg_kJkg))
      : 0;
  const point4 = buildStatePoint(
    Te,
    satEvap.P_kPa,
    h4,
    satEvap.s_f_kJkgK,
    quality4,
  );

  return {
    converged,
    iterations,
    residual,
    Te_C: Te,
    Tc_C: Tc,
    m_dot_kgS: mDot,
    Q_evap_W: QEvapW,
    Q_cond_W: QCondW,
    W_comp_W: WCompW,
    COP,
    EER,
    statePoints: {
      point1_evapOut: point1,
      point2_compOut: point2,
      point3_condOut: point3,
      point4_valveOut: point4,
    },
    evaporatorResult: {
      totalCapacityW: lastEvapResult?.totalCapacityW ?? 0,
      sensibleCapacityW: lastEvapResult?.sensibleCapacityW ?? 0,
      latentCapacityW: lastEvapResult?.latentCapacityW ?? 0,
      airOutletTempC: lastEvapResult?.airOutletTempC ?? 0,
      airOutletRH: lastEvapResult?.airOutletRH ?? 0,
      airPressureDropPa: lastEvapResult?.airPressureDropPa ?? 0,
      fluidPressureDropKPa: lastEvapResult?.fluidPressureDropKPa ?? 0,
      overallU_WM2K: lastEvapResult?.overallU_WM2K ?? 0,
      safetyFactor: lastEvapResult?.safetyFactor ?? 0,
    },
    condenserResult: {
      totalCapacityW: lastCondResult?.totalCapacityW ?? 0,
      airOutletTempC: lastCondResult?.airOutletTempC ?? 0,
      airPressureDropPa: lastCondResult?.airPressureDropPa ?? 0,
      fluidPressureDropKPa: lastCondResult?.fluidPressureDropKPa ?? 0,
      overallU_WM2K: lastCondResult?.overallU_WM2K ?? 0,
    },
    compressorResult: {
      Q_evap_W: lastCompResult?.Q_evap_W ?? 0,
      W_comp_W: WCompW,
      COP: lastCompResult?.COP ?? 0,
      compressionRatio: lastCompResult?.compressionRatio ?? 0,
      mode: lastCompResult?.mode ?? "constant_efficiency",
    },
    expansionDevice: lastExpansionResult ?? undefined,
    inletQuality: lastExpansionResult?.inletQuality,
    warnings,
  };
}

export interface CycleSystemConfigWithAssembly
  extends Omit<CycleSystemConfig, "evaporator" | "condenser"> {
  evaporatorAssembly: CoilAssemblyConfig;
  condenserAssembly: CoilAssemblyConfig;
}

/**
 * Versão do CycleEngine que suporta CoilAssembly (múltiplos trocadores).
 * Usa runAssemblySimulation() no lugar de runCoilForCycle() direto.
 */
export async function runCycleSimulationWithAssembly(
  config: CycleSystemConfigWithAssembly,
): Promise<CycleResult> {
  const [evapAssembly, condAssembly] = await Promise.all([
    runAssemblySimulation(config.evaporatorAssembly),
    runAssemblySimulation(config.condenserAssembly),
  ]);

  const baseConfig: CycleSystemConfig = {
    ...config,
    evaporator: {
      ...config.evaporatorAssembly.coils[0].coilInputs,
      airInletTempC: config.evaporatorAssembly.airInlet.tempC,
      airRelativeHumidity: config.evaporatorAssembly.airInlet.relativeHumidity,
      superheatK: config.evaporatorAssembly.refrigerant.superheatK,
      subcoolingK: config.evaporatorAssembly.refrigerant.subcoolingK,
    },
    condenser: {
      ...config.condenserAssembly.coils[0].coilInputs,
      airInletTempC: config.condenserAssembly.airInlet.tempC,
      airRelativeHumidity: config.condenserAssembly.airInlet.relativeHumidity,
      superheatK: config.condenserAssembly.refrigerant.superheatK,
      subcoolingK: config.condenserAssembly.refrigerant.subcoolingK,
    },
  };

  const cycleResult = await runCycleSimulation(baseConfig);
  const assemblyWarnings = [
    ...evapAssembly.warnings,
    ...condAssembly.warnings,
  ].filter((warning) => !cycleResult.warnings.includes(warning));

  return {
    ...cycleResult,
    warnings: [...cycleResult.warnings, ...assemblyWarnings],
  };
}
