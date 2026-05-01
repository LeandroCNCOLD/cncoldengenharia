import type {
  DefrostCycleInput,
  DefrostCycleResult,
  DefrostComponentRecommendation,
} from "../../domain/types";

const C_ICE_KJ_KGK = 2.09;
const LF_KJ_KG = 334;

export function calculateDefrostCycle(input: DefrostCycleInput): DefrostCycleResult {
  const warnings: string[] = [];
  const risk_notes: string[] = [];

  if (input.frost_mass_kg <= 0) {
    warnings.push("frost_mass_kg <= 0.");
    return buildErrorResult(input, warnings);
  }
  if (input.compressor_capacity_w <= 0) {
    warnings.push("compressor_capacity_w <= 0.");
    return buildErrorResult(input, warnings);
  }
  if (input.T_condensing_c <= input.T_evaporating_c) {
    warnings.push("T_condensing_c <= T_evaporating_c. Ciclo inválido.");
    return buildErrorResult(input, warnings);
  }
  if (input.method === "electric" && !input.evaporator_external_area_m2) {
    warnings.push("Método elétrico requer evaporator_external_area_m2.");
    return buildErrorResult(input, warnings);
  }

  const Q_sensible =
    input.frost_mass_kg * C_ICE_KJ_KGK * Math.max(0, 0 - input.frost_temperature_c);
  const Q_latent = input.frost_mass_kg * LF_KJ_KG;
  const Q_total = Q_sensible + Q_latent;

  const bypassFraction = input.bypass_fraction ?? 0.3;
  const compKw = input.compressor_capacity_w / 1000;

  let Q_available_w: number;
  const components: DefrostComponentRecommendation[] = [];
  let liquidRisk: DefrostCycleResult["liquid_return_risk"] = "low";
  let reversalFraction: number | undefined;
  let bypassMassFlow: number | undefined;
  let bypassDiameter: number | undefined;
  let accumulatorVolume: number | undefined;
  let electricPower: number | undefined;
  let electricDensity: number | undefined;

  switch (input.method) {
    case "hot_gas_reversal": {
      reversalFraction = 0.8;
      Q_available_w = reversalFraction * input.compressor_capacity_w;

      const fluidCharge = 0.5 * compKw;
      accumulatorVolume = fluidCharge * 0.75;

      components.push(
        {
          component: "Válvula 4 vias",
          specification: `Capacidade ≥ ${compKw.toFixed(1)} kW`,
          critical: true,
          notes: "Necessária para reversão do ciclo",
        },
        {
          component: "Bypass da válvula de expansão",
          specification: "Check valve ou solenóide bypass",
          critical: true,
          notes: "Permite fluxo reverso durante degelo",
        },
        {
          component: "Acumulador de sucção",
          specification: `Volume ≥ ${accumulatorVolume.toFixed(2)} L`,
          critical: true,
          notes: "Protege compressor contra golpe de líquido",
        },
      );

      liquidRisk = "medium";
      risk_notes.push(
        "Reversão de gás quente pode causar retorno de líquido ao compressor.",
        "Acumulador de sucção dimensionado adequadamente mitiga o risco.",
      );
      break;
    }

    case "hot_gas_bypass": {
      Q_available_w = bypassFraction * input.compressor_capacity_w * 1.2;

      const deltaH = 50000;
      bypassMassFlow = Q_available_w / deltaH;

      const rhoVapor = 80;
      const vVapor = 10;
      const D = Math.sqrt((4 * bypassMassFlow) / (Math.PI * rhoVapor * vVapor));
      bypassDiameter = D * 1000;

      const fluidCharge = 0.5 * compKw;
      accumulatorVolume = fluidCharge * 0.75 * 0.75;

      components.push(
        {
          component: "Válvula solenóide de bypass",
          specification: `Vazão ≥ ${(bypassMassFlow * 3600).toFixed(1)} kg/h`,
          critical: true,
          notes: "Controla o desvio de gás quente para o evaporador",
        },
        {
          component: "Linha de bypass",
          specification: `Diâmetro ≥ ${bypassDiameter.toFixed(1)} mm`,
          critical: true,
          notes: "Dimensionada para velocidade máxima de 10 m/s",
        },
        {
          component: "Acumulador de sucção",
          specification: `Volume ≥ ${accumulatorVolume.toFixed(2)} L`,
          critical: true,
          notes: "Protege compressor contra golpe de líquido",
        },
        {
          component: "Regulador de pressão de evaporação",
          specification: "EPR ou KVP",
          critical: false,
          notes: "Recomendado para controle de pressão durante degelo",
        },
      );

      liquidRisk = "high";
      risk_notes.push(
        "Bypass de gás quente tem alto risco de retorno de líquido.",
        "Acumulador de sucção é obrigatório.",
        "Monitorar pressão de sucção durante ciclo de degelo.",
      );
      break;
    }

    case "electric": {
      const area = input.evaporator_external_area_m2!;
      const powerDensity = 300;
      const electricBase = powerDensity * area;
      const electricCheck = 0.15 * input.compressor_capacity_w;
      electricPower = Math.max(electricBase, electricCheck);
      electricDensity = electricPower / area;

      Q_available_w = electricPower;

      components.push(
        {
          component: "Resistência elétrica",
          specification: `Potência ≥ ${(electricPower / 1000).toFixed(2)} kW`,
          critical: true,
          notes: `Densidade: ${electricDensity.toFixed(0)} W/m²`,
        },
        {
          component: "Termostato de degelo",
          specification: "Faixa -10°C a +15°C",
          critical: true,
          notes: "Controla início e fim do ciclo de degelo",
        },
        {
          component: "Timer de degelo",
          specification: "Programável",
          critical: false,
          notes: "Recomendado para automação do ciclo",
        },
      );

      liquidRisk = "low";
      risk_notes.push("Degelo elétrico não gera risco de retorno de líquido ao compressor.");
      break;
    }
  }

  const defrostTimeMin = Q_available_w > 0 ? (Q_total * 1000) / Q_available_w / 60 : Infinity;
  const maxTime = input.max_defrost_time_min ?? 30;
  const feasible = Number.isFinite(defrostTimeMin) && defrostTimeMin <= maxTime;

  if (!feasible) {
    warnings.push(
      `Tempo de degelo (${defrostTimeMin.toFixed(1)} min) excede limite (${maxTime} min).`,
    );
  }

  return {
    method: input.method,
    Q_sensible_kj: Q_sensible,
    Q_latent_kj: Q_latent,
    Q_total_required_kj: Q_total,
    Q_defrost_available_w: Q_available_w,
    Q_defrost_available_kw: Q_available_w / 1000,
    defrost_time_min: defrostTimeMin,
    defrost_time_feasible: feasible,
    reversal_q_fraction: reversalFraction,
    bypass_mass_flow_kg_s: bypassMassFlow,
    bypass_line_diameter_mm: bypassDiameter,
    accumulator_volume_l: accumulatorVolume,
    electric_power_w: electricPower,
    electric_power_density_w_m2: electricDensity,
    components,
    liquid_return_risk: liquidRisk,
    risk_notes,
    warnings,
    status: feasible ? "ok" : "warning",
  };
}

function buildErrorResult(input: DefrostCycleInput, warnings: string[]): DefrostCycleResult {
  return {
    method: input.method,
    Q_sensible_kj: 0,
    Q_latent_kj: 0,
    Q_total_required_kj: 0,
    Q_defrost_available_w: 0,
    Q_defrost_available_kw: 0,
    defrost_time_min: 0,
    defrost_time_feasible: false,
    components: [],
    liquid_return_risk: "low",
    risk_notes: [],
    warnings,
    status: "error",
  };
}
