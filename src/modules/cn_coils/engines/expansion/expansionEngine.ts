import { getRefrigerantSatProps } from "../refrigerant/refrigerantProperties";
import type {
  CapillaryConfig,
  EEVConfig,
  ExpansionDeviceInput,
  ExpansionDeviceResult,
  ExpansionDeviceType,
  FixedOrificeConfig,
  TXVConfig,
} from "./expansionTypes";

async function calculateFlash(
  condenserOutletEnthalpyKJkg: number,
  evaporatingTempC: number,
  refrigerantId: string,
): Promise<{ inletQuality: number; inletEnthalpyKJkg: number; warnings: string[] }> {
  const satProps = await getRefrigerantSatProps(refrigerantId, evaporatingTempC);
  const inletEnthalpyKJkg = condenserOutletEnthalpyKJkg;
  const inletQuality = satProps.h_fg_kJkg > 0
    ? Math.max(0, Math.min(1, (inletEnthalpyKJkg - satProps.h_f_kJkg) / satProps.h_fg_kJkg))
    : 0;
  return { inletQuality, inletEnthalpyKJkg, warnings: satProps.warnings };
}

async function condenserOutletEnthalpy(
  condensingTempC: number,
  subcoolingK: number,
  refrigerantId: string,
): Promise<{ hKJkg: number; warnings: string[] }> {
  const satProps = await getRefrigerantSatProps(refrigerantId, condensingTempC);
  return {
    hKJkg: satProps.h_f_kJkg - satProps.liquid.cp_kJkgK * subcoolingK,
    warnings: satProps.warnings,
  };
}

async function evaluateTXV(
  cfg: TXVConfig,
  input: ExpansionDeviceInput,
): Promise<{
  massFlowKgS: number | null;
  opening: number;
  warnings: string[];
  converged: boolean;
  iterations: number;
}> {
  const warnings: string[] = [];
  const Te = input.evaporatingTempC;
  const Tc = input.condensingTempC;
  const SHTarget = cfg.superheatTargetK;
  const SHActual = input.actualSuperheatK ?? SHTarget;
  const [satTe, satTc] = await Promise.all([
    getRefrigerantSatProps(input.refrigerantId, Te),
    getRefrigerantSatProps(input.refrigerantId, Tc),
  ]);
  warnings.push(...satTe.warnings, ...satTc.warnings);

  const deltaPKPa = satTc.P_kPa - satTe.P_kPa;
  if (deltaPKPa <= 0) {
    warnings.push("ΔP negativo — Te ≥ Tc. Verifique as temperaturas do ciclo.");
    return { massFlowKgS: null, opening: 0, warnings, converged: false, iterations: 0 };
  }

  let satBulb = satTe;
  try {
    satBulb = await getRefrigerantSatProps(input.refrigerantId, Te + SHActual);
    warnings.push(...satBulb.warnings);
  } catch {
    warnings.push("Temperatura do bulbo fora da faixa — usando P_sat(Te).");
  }

  const pSpanKPa = cfg.springConstantKPaPerK * Math.max(cfg.superheatMaxK - cfg.superheatMinK, 1);
  const pTargetKPa = Math.max(
    0,
    satBulb.P_kPa - satTe.P_kPa - cfg.springConstantKPaPerK * (SHActual - SHTarget),
  );
  const opening = Math.max(
    0,
    Math.min(1, pTargetKPa / pSpanKPa),
  );

  if (opening < 0.05) warnings.push(`TXV quase fechada (abertura ${(opening * 100).toFixed(1)}%). SH real muito baixo.`);
  if (opening > 0.95) warnings.push(`TXV quase totalmente aberta (abertura ${(opening * 100).toFixed(1)}%). Capacidade pode ser insuficiente.`);
  if (SHActual < cfg.superheatMinK) warnings.push(`SH real (${SHActual.toFixed(1)} K) abaixo do mínimo (${cfg.superheatMinK} K). Risco de retorno de líquido.`);
  if (SHActual > cfg.superheatMaxK) warnings.push(`SH real (${SHActual.toFixed(1)} K) acima do máximo (${cfg.superheatMaxK} K). Capacidade reduzida.`);

  const rhoLiq = satTc.liquid.rho_kgm3;
  const kvNominal = cfg.kvNominal ??
    Math.sqrt(
      (cfg.nominalCapacityW / 1000 / Math.max(satTe.h_fg_kJkg, 1)) ** 2 /
      Math.max(2 * rhoLiq * cfg.nominalDeltaPressureKPa * 1000, 1),
    ) * 3600;
  const massFlowKgS = (kvNominal * opening / 3600) * rhoLiq * Math.sqrt(deltaPKPa / 100);

  if (massFlowKgS <= 0) {
    warnings.push("Vazão mássica calculada ≤ 0. Verifique os parâmetros da TXV.");
    return { massFlowKgS: null, opening, warnings, converged: false, iterations: 1 };
  }
  return { massFlowKgS, opening, warnings, converged: true, iterations: 1 };
}

async function evaluateEEV(
  cfg: EEVConfig,
  input: ExpansionDeviceInput,
): Promise<{ massFlowKgS: number; opening: number; warnings: string[]; converged: boolean; iterations: number }> {
  const warnings: string[] = [];
  const [satTe, satTc] = await Promise.all([
    getRefrigerantSatProps(input.refrigerantId, input.evaporatingTempC),
    getRefrigerantSatProps(input.refrigerantId, input.condensingTempC),
  ]);
  warnings.push(...satTe.warnings, ...satTc.warnings);
  const deltaPKPa = Math.max(0, satTc.P_kPa - satTe.P_kPa);
  const areaM2 = Math.PI * (cfg.orificeDiameterMm / 1000 / 2) ** 2;
  const massFlowKgS =
    cfg.dischargeCoefficient * areaM2 * Math.sqrt(2 * satTc.liquid.rho_kgm3 * deltaPKPa * 1000) * cfg.openingFraction;
  if (cfg.openingFraction < 0.1) {
    warnings.push(`EEV com abertura muito baixa (${(cfg.openingFraction * 100).toFixed(0)}%). Vazão pode ser insuficiente.`);
  }
  return { massFlowKgS, opening: cfg.openingFraction, warnings, converged: true, iterations: 1 };
}

async function evaluateCapillary(
  cfg: CapillaryConfig,
  input: ExpansionDeviceInput,
): Promise<{ massFlowKgS: number; warnings: string[]; converged: boolean }> {
  const warnings: string[] = [];
  const [satTe, satTc] = await Promise.all([
    getRefrigerantSatProps(input.refrigerantId, input.evaporatingTempC),
    getRefrigerantSatProps(input.refrigerantId, input.condensingTempC),
  ]);
  warnings.push(...satTe.warnings, ...satTc.warnings);
  const deltaPPa = (satTc.P_kPa - satTe.P_kPa) * 1000;
  const dM = cfg.internalDiameterMm / 1000;
  if (deltaPPa <= 0 || dM <= 0 || cfg.lengthM <= 0) {
    warnings.push("ΔP ou geometria inválida no tubo capilar.");
    return { massFlowKgS: 0, warnings, converged: false };
  }

  let velocity = Math.sqrt(2 * deltaPPa / (satTc.liquid.rho_kgm3 * (cfg.lengthM / dM)));
  for (let i = 0; i < 10; i++) {
    const reynolds = (satTc.liquid.rho_kgm3 * velocity * dM) / satTc.liquid.mu_Pas;
    const friction = reynolds < 2300 ? 64 / Math.max(reynolds, 1) : 0.316 / Math.pow(reynolds, 0.25);
    velocity = Math.sqrt(2 * deltaPPa / (satTc.liquid.rho_kgm3 * friction * cfg.lengthM / dM));
  }
  const areaM2 = Math.PI * (dM / 2) ** 2;
  const massFlowKgS = satTc.liquid.rho_kgm3 * velocity * areaM2;
  if (cfg.lengthM < 0.5) warnings.push("Tubo capilar muito curto (< 0,5 m). Resultado pode ser impreciso.");
  if (cfg.lengthM > 5) warnings.push("Tubo capilar muito longo (> 5 m). Verificar se é o comprimento correto.");
  return { massFlowKgS, warnings, converged: true };
}

async function evaluateFixedOrifice(
  cfg: FixedOrificeConfig,
  input: ExpansionDeviceInput,
): Promise<{ massFlowKgS: number; warnings: string[] }> {
  const warnings: string[] = [];
  const [satTe, satTc] = await Promise.all([
    getRefrigerantSatProps(input.refrigerantId, input.evaporatingTempC),
    getRefrigerantSatProps(input.refrigerantId, input.condensingTempC),
  ]);
  warnings.push(...satTe.warnings, ...satTc.warnings);
  const deltaPPa = Math.max(0, (satTc.P_kPa - satTe.P_kPa) * 1000);
  const areaM2 = Math.PI * (cfg.orificeDiameterMm / 1000 / 2) ** 2;
  const massFlowKgS = cfg.dischargeCoefficient * areaM2 * Math.sqrt(2 * satTc.liquid.rho_kgm3 * deltaPPa);
  if (massFlowKgS <= 0) warnings.push("Vazão mássica calculada ≤ 0 no orifício fixo.");
  return { massFlowKgS, warnings };
}

export async function evaluateExpansionDevice(
  input: ExpansionDeviceInput,
): Promise<ExpansionDeviceResult> {
  const warnings: string[] = [];
  const condenserOutlet = await condenserOutletEnthalpy(
    input.condensingTempC,
    input.subcoolingK,
    input.refrigerantId,
  );
  warnings.push(...condenserOutlet.warnings);
  const flash = await calculateFlash(
    condenserOutlet.hKJkg,
    input.evaporatingTempC,
    input.refrigerantId,
  );
  warnings.push(...flash.warnings);
  const [satTe, satTc] = await Promise.all([
    getRefrigerantSatProps(input.refrigerantId, input.evaporatingTempC),
    getRefrigerantSatProps(input.refrigerantId, input.condensingTempC),
  ]);
  warnings.push(...satTe.warnings, ...satTc.warnings);
  const availableDeltaPressureKPa = satTc.P_kPa - satTe.P_kPa;

  if (flash.inletQuality > 0.10) {
    warnings.push(
      `Flash na expansão: título de entrada = ${(flash.inletQuality * 100).toFixed(1)}%. Considere aumentar o subresfriamento (atual: ${input.subcoolingK.toFixed(1)} K).`,
    );
  }

  if (input.mode === "disabled" || !input.device) {
    return {
      mode: "disabled",
      deviceType: "none",
      inletQuality: flash.inletQuality,
      inletEnthalpyKJkg: flash.inletEnthalpyKJkg,
      condenserOutletEnthalpyKJkg: condenserOutlet.hKJkg,
      massFlowKgS: null,
      availableDeltaPressureKPa,
      effectiveOpening: null,
      superheatTargetK: null,
      validation: { capacityOk: true, pressureRangeOk: true, superheatViable: true, operatingRangeOk: true },
      warnings,
      converged: true,
      iterations: 0,
    };
  }

  let massFlowKgS: number | null = null;
  let effectiveOpening: number | null = null;
  let superheatTargetK: number | null = null;
  let converged = true;
  let iterations = 0;
  let deviceType: ExpansionDeviceType = "none";

  if (input.device.type === "txv") {
    deviceType = "txv";
    superheatTargetK = input.device.superheatTargetK;
    const result = await evaluateTXV(input.device, input);
    massFlowKgS = result.massFlowKgS;
    effectiveOpening = result.opening;
    converged = result.converged;
    iterations = result.iterations;
    warnings.push(...result.warnings);
  } else if (input.device.type === "eev") {
    deviceType = "eev";
    superheatTargetK = input.device.superheatTargetK;
    const result = await evaluateEEV(input.device, input);
    massFlowKgS = result.massFlowKgS;
    effectiveOpening = result.opening;
    converged = result.converged;
    iterations = result.iterations;
    warnings.push(...result.warnings);
  } else if (input.device.type === "capillary") {
    deviceType = "capillary";
    const result = await evaluateCapillary(input.device, input);
    massFlowKgS = result.massFlowKgS;
    converged = result.converged;
    warnings.push(...result.warnings);
  } else if (input.device.type === "fixed_orifice") {
    deviceType = "fixed_orifice";
    const result = await evaluateFixedOrifice(input.device, input);
    massFlowKgS = result.massFlowKgS;
    warnings.push(...result.warnings);
  }

  const validation = {
    capacityOk: massFlowKgS !== null && massFlowKgS > 0,
    pressureRangeOk: availableDeltaPressureKPa > 0,
    superheatViable: flash.inletQuality < 0.15,
    operatingRangeOk: input.evaporatingTempC < input.condensingTempC,
  };

  if (!validation.capacityOk && input.mode === "passive") {
    warnings.push("Validação passiva: capacidade de vazão insuficiente para as condições informadas.");
  }
  if (!validation.pressureRangeOk) {
    warnings.push("Validação passiva: ΔP disponível ≤ 0. Verificar Te e Tc.");
  }
  if (!validation.superheatViable) {
    warnings.push("Validação passiva: título de entrada > 15%. Subresfriamento insuficiente.");
  }

  return {
    mode: input.mode,
    deviceType,
    inletQuality: flash.inletQuality,
    inletEnthalpyKJkg: flash.inletEnthalpyKJkg,
    condenserOutletEnthalpyKJkg: condenserOutlet.hKJkg,
    massFlowKgS,
    availableDeltaPressureKPa,
    effectiveOpening,
    superheatTargetK,
    validation,
    warnings,
    converged,
    iterations,
  };
}
