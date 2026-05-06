/**
 * compressorSelector.ts
 *
 * Lógica de seleção e avaliação de compressor por ponto de operação (Te, Tc).
 *
 * Suporta dois tipos de registros:
 *   - Tipo A (UNILAB/VAPCYC): coeficientes ARI 540 / EN 12900 com 10 termos
 *     → Q(Te,Tc) e W(Te,Tc) calculados diretamente para qualquer ponto do envelope
 *   - Tipo B (CN Coils): coeficientes bicúbicos com 20 termos (configuração coil+compressor)
 *     → Dados nominais usados diretamente; seleção por configuração, não por ponto
 *   - Tipo C (nominal apenas): sem coeficientes
 *     → Dados nominais usados com aviso
 *
 * Referências:
 *   - AHRI Standard 540 (2020): Performance Rating of Positive Displacement
 *     Refrigerant Compressors and Compressor Units
 *   - EN 12900:2013: Refrigerant compressors — Rating conditions, tolerances
 *     and presentation of manufacturer's performance data
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CompressorRecord {
  id?: string;
  source?: string;
  model: string;
  manufacturer?: string;
  refrigerant?: string[];
  type?: string;
  cooling_capacity_kw?: number;
  power_input_kw?: number;
  cop?: number | null;
  min_evap_temp_c?: number | null;
  max_evap_temp_c?: number | null;
  min_cond_temp_c?: number | null;
  max_cond_temp_c?: number | null;
  nominal_conditions?: {
    te_c?: number;
    tc_c?: number;
    superheat_k?: number;
    subcooling_k?: number;
  };
  capacity_coefficients?: number[];
  power_coefficients?: number[];
  current_coefficients?: number[];
  data_quality?: string;
  standard?: string;
}

export type CompressorEvalStatus =
  | "ok"                    // Ponto dentro do envelope, coeficientes usados
  | "ok_nominal"            // Sem coeficientes, dados nominais usados
  | "clamped"               // Ponto fora do envelope, clampado ao limite
  | "out_of_envelope"       // Ponto fora do envelope (aviso severo)
  | "no_data";              // Sem dados suficientes

export interface CompressorEvalResult {
  /** Capacidade frigorífica calculada (kW) */
  cooling_capacity_kw: number;
  /** Potência absorvida calculada (kW) */
  power_input_kw: number;
  /** Corrente elétrica calculada (A) — null se não disponível */
  current_a: number | null;
  /** COP calculado */
  cop: number;
  /** Temperatura de evaporação usada no cálculo (pode ser clampada) */
  te_used_c: number;
  /** Temperatura de condensação usada no cálculo (pode ser clampada) */
  tc_used_c: number;
  /** Status da avaliação */
  status: CompressorEvalStatus;
  /** Mensagens de aviso */
  warnings: string[];
  /** Tipo de dado usado */
  data_type: "polynomial_ari540" | "polynomial_cn_coils" | "nominal";
  /** Registro usado */
  record: CompressorRecord;
}

export interface CompressorSelectionResult {
  /** Resultado da avaliação no ponto de operação */
  evaluation: CompressorEvalResult;
  /** Todos os registros candidatos encontrados */
  candidates: CompressorRecord[];
  /** Índice do registro selecionado em candidates */
  selected_index: number;
}

// ─── Equação polinomial ARI 540 (10 termos) ──────────────────────────────────

/**
 * Avalia a equação bicúbica parcial ARI 540 / EN 12900:
 *   Y = C1 + C2·Te + C3·Tc + C4·Te² + C5·Te·Tc + C6·Tc²
 *       + C7·Te³ + C8·Te²·Tc + C9·Te·Tc² + C10·Tc³
 *
 * @param coef - Array de 10 coeficientes [C1..C10]
 * @param te   - Temperatura de evaporação (°C)
 * @param tc   - Temperatura de condensação (°C)
 * @returns Valor calculado (kW para capacidade/potência, A para corrente)
 */
export function evalPoly10(coef: number[], te: number, tc: number): number {
  if (coef.length < 10) return NaN;
  const [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10] = coef;
  return (
    c1 +
    c2 * te +
    c3 * tc +
    c4 * te * te +
    c5 * te * tc +
    c6 * tc * tc +
    c7 * te * te * te +
    c8 * te * te * tc +
    c9 * te * tc * tc +
    c10 * tc * tc * tc
  );
}

/**
 * Avalia equação bicúbica completa com 20 termos (CN Coils).
 * Inclui termos cruzados adicionais além do ARI 540.
 */
export function evalPoly20(coef: number[], te: number, tc: number): number {
  if (coef.length < 20) return evalPoly10(coef, te, tc);
  const [c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,
         c11,c12,c13,c14,c15,c16,c17,c18,c19,c20] = coef;
  return (
    c1 +
    c2 * te + c3 * tc +
    c4 * te * te + c5 * te * tc + c6 * tc * tc +
    c7 * te * te * te + c8 * te * te * tc + c9 * te * tc * tc + c10 * tc * tc * tc +
    c11 * te * te * te * te +
    c12 * te * te * te * tc +
    c13 * te * te * tc * tc +
    c14 * te * tc * tc * tc +
    c15 * tc * tc * tc * tc +
    c16 * te * te * te * te * te +
    c17 * te * te * te * te * tc +
    c18 * te * te * te * tc * tc +
    c19 * te * te * tc * tc * tc +
    c20 * te * tc * tc * tc * tc
  );
}

// ─── Verificação de envelope ──────────────────────────────────────────────────

export interface EnvelopeCheckResult {
  inside: boolean;
  te_clamped: number;
  tc_clamped: number;
  te_warning: string | null;
  tc_warning: string | null;
}

/**
 * Verifica se (Te, Tc) está dentro do envelope operacional do compressor.
 * Retorna os valores clampados ao limite mais próximo se estiver fora.
 */
export function checkEnvelope(
  record: CompressorRecord,
  te: number,
  tc: number
): EnvelopeCheckResult {
  const teMin = record.min_evap_temp_c ?? -40;
  const teMax = record.max_evap_temp_c ?? 15;
  // Nota: no banco CN Coils, min_cond e max_cond estão invertidos (bug histórico)
  // Normalizar: min < max
  const condA = record.min_cond_temp_c ?? 20;
  const condB = record.max_cond_temp_c ?? 60;
  const tcMin = Math.min(condA, condB);
  const tcMax = Math.max(condA, condB);

  let teClamped = te;
  let tcClamped = tc;
  let teWarning: string | null = null;
  let tcWarning: string | null = null;

  if (te < teMin) {
    teClamped = teMin;
    teWarning = `Te=${te.toFixed(1)}°C abaixo do mínimo (${teMin}°C) — clampado`;
  } else if (te > teMax) {
    teClamped = teMax;
    teWarning = `Te=${te.toFixed(1)}°C acima do máximo (${teMax}°C) — clampado`;
  }

  if (tc < tcMin) {
    tcClamped = tcMin;
    tcWarning = `Tc=${tc.toFixed(1)}°C abaixo do mínimo (${tcMin}°C) — clampado`;
  } else if (tc > tcMax) {
    tcClamped = tcMax;
    tcWarning = `Tc=${tc.toFixed(1)}°C acima do máximo (${tcMax}°C) — clampado`;
  }

  return {
    inside: teClamped === te && tcClamped === tc,
    te_clamped: teClamped,
    tc_clamped: tcClamped,
    te_warning: teWarning,
    tc_warning: tcWarning,
  };
}

// ─── Avaliação de um registro em um ponto ────────────────────────────────────

/**
 * Avalia a capacidade e potência de um compressor em um ponto de operação (Te, Tc).
 *
 * Hierarquia de dados:
 * 1. Coeficientes ARI 540 (10 termos) — mais preciso, cobre toda a faixa
 * 2. Coeficientes CN Coils (20 termos) — configuração coil+compressor
 * 3. Dados nominais — fallback com aviso
 */
export function evaluateCompressorAtPoint(
  record: CompressorRecord,
  te: number,
  tc: number
): CompressorEvalResult {
  const warnings: string[] = [];
  const capCoef = record.capacity_coefficients ?? [];
  const pwrCoef = record.power_coefficients ?? [];
  const curCoef = record.current_coefficients ?? [];

  const hasAri540 = capCoef.length >= 10 && capCoef.some((c) => c !== 0);
  const hasPwr = pwrCoef.length >= 10 && pwrCoef.some((c) => c !== 0);
  const hasCur = curCoef.length >= 10 && curCoef.some((c) => c !== 0);
  const isCnCoils = (record.source ?? "").startsWith("CN Coils");

  if (hasAri540) {
    // ── Verificar envelope ──────────────────────────────────────────────────
    const envelope = checkEnvelope(record, te, tc);

    if (!envelope.inside) {
      if (envelope.te_warning) warnings.push(envelope.te_warning);
      if (envelope.tc_warning) warnings.push(envelope.tc_warning);
    }

    const teEval = envelope.te_clamped;
    const tcEval = envelope.tc_clamped;

    // ── Calcular com polinômio ──────────────────────────────────────────────
     const evalFn = isCnCoils && capCoef.length >= 20 ? evalPoly20 : evalPoly10;

    // ── Detectar unidades dos coeficientes ─────────────────────────────────
    // AHRI 540 americano (VAPCYC): Te/Tc em °F, saída em BTU/h
    // EN 12900 europeu (UNILAB, CN Coils): Te/Tc em °C, saída em W ou kW
    const coefUnits = (record as unknown as Record<string, unknown>)["coefficient_units"] as string | undefined;
    const isAhri540F = coefUnits?.includes("degF") || (record.standard === "AHRI540" && !isCnCoils);
    const BTU_H_TO_KW = 1 / 3412.142;
    const C_TO_F = (c: number) => c * 9 / 5 + 32;

    const teForEval = isAhri540F ? C_TO_F(teEval) : teEval;
    const tcForEval = isAhri540F ? C_TO_F(tcEval) : tcEval;

    let capRaw = evalFn(capCoef, teForEval, tcForEval);
    let pwrRaw = hasPwr ? evalFn(pwrCoef, teForEval, tcForEval) : NaN;
    let curRaw = hasCur ? evalFn(curCoef, teForEval, tcForEval) : null;

    // Converter para kW
    let capKw = isAhri540F ? capRaw * BTU_H_TO_KW : capRaw > 500 ? capRaw / 1000 : capRaw;
    let pwrKw = isAhri540F ? pwrRaw * BTU_H_TO_KW : pwrRaw > 500 ? pwrRaw / 1000 : pwrRaw;
    let curA = curRaw !== null ? curRaw : null;

    // Sanidade: valores negativos ou absurdos
    if (capKw <= 0 || !isFinite(capKw)) {
      warnings.push(
        `Polinômio retornou capacidade inválida (${capKw?.toFixed(2)} kW) em Te=${teEval}°C, Tc=${tcEval}°C — usando nominal`
      );
      capKw = record.cooling_capacity_kw ?? 0;
    }
    if (!isFinite(pwrKw) || pwrKw <= 0) {
      pwrKw = record.power_input_kw ?? (capKw > 0 ? capKw / 3.0 : 1.0);
    }
    if (curA !== null && (!isFinite(curA) || curA < 0)) {
      curA = null;
    }

    const cop = pwrKw > 0 ? capKw / pwrKw : 0;

    return {
      cooling_capacity_kw: Math.round(capKw * 1000) / 1000,
      power_input_kw: Math.round(pwrKw * 1000) / 1000,
      current_a: curA !== null ? Math.round(curA * 100) / 100 : null,
      cop: Math.round(cop * 1000) / 1000,
      te_used_c: teEval,
      tc_used_c: tcEval,
      status: envelope.inside ? "ok" : "clamped",
      warnings,
      data_type: isCnCoils ? "polynomial_cn_coils" : "polynomial_ari540",
      record,
    };
  }

  // ── Fallback: dados nominais ─────────────────────────────────────────────
  const capKw = record.cooling_capacity_kw ?? 0;
  const pwrKw = record.power_input_kw ?? (capKw > 0 ? capKw / 3.0 : 1.0);
  const cop = pwrKw > 0 ? capKw / pwrKw : 0;

  if (capKw <= 0) {
    warnings.push("Sem dados de capacidade disponíveis");
    return {
      cooling_capacity_kw: 0,
      power_input_kw: 0,
      current_a: null,
      cop: 0,
      te_used_c: te,
      tc_used_c: tc,
      status: "no_data",
      warnings,
      data_type: "nominal",
      record,
    };
  }

  const nc = record.nominal_conditions;
  if (nc?.te_c !== undefined && nc?.tc_c !== undefined) {
    warnings.push(
      `Sem coeficientes polinomiais — usando dados nominais (Te_ref=${nc.te_c}°C, Tc_ref=${nc.tc_c}°C)`
    );
  } else {
    warnings.push("Sem coeficientes polinomiais — usando dados nominais");
  }

  return {
    cooling_capacity_kw: Math.round(capKw * 1000) / 1000,
    power_input_kw: Math.round(pwrKw * 1000) / 1000,
    current_a: null,
    cop: Math.round(cop * 1000) / 1000,
    te_used_c: te,
    tc_used_c: tc,
    status: "ok_nominal",
    warnings,
    data_type: "nominal",
    record,
  };
}

// ─── Seleção do melhor registro ───────────────────────────────────────────────

/**
 * Dado um conjunto de registros do mesmo modelo, seleciona o que melhor
 * cobre o ponto de operação (Te, Tc).
 *
 * Critério de seleção (por prioridade):
 * 1. Registros com coeficientes ARI 540 cujo envelope cobre o ponto
 * 2. Registros com coeficientes ARI 540 (mesmo que clampem)
 * 3. Registros nominais com Te_ref mais próximo do ponto
 * 4. Qualquer registro disponível
 */
export function selectBestCompressorRecord(
  candidates: CompressorRecord[],
  te: number,
  tc: number
): { record: CompressorRecord; index: number } {
  if (candidates.length === 0) {
    throw new Error("Nenhum registro de compressor disponível");
  }
  if (candidates.length === 1) {
    return { record: candidates[0], index: 0 };
  }

  // Pontuar cada candidato
  const scored = candidates.map((rec, idx) => {
    const capCoef = rec.capacity_coefficients ?? [];
    const hasCoef = capCoef.length >= 10 && capCoef.some((c) => c !== 0);

    if (!hasCoef) {
      // Sem coeficientes: pontuar por proximidade ao ponto nominal
      const nc = rec.nominal_conditions;
      const teRef = nc?.te_c ?? rec.min_evap_temp_c ?? -10;
      const tcRef = nc?.tc_c ?? 40;
      const dist = Math.abs(te - teRef) + Math.abs(tc - tcRef) * 0.5;
      return { idx, score: -dist, inside: false };
    }

    const envelope = checkEnvelope(rec, te, tc);
    const teMin = rec.min_evap_temp_c ?? -40;
    const teMax = rec.max_evap_temp_c ?? 15;
    const condA = rec.min_cond_temp_c ?? 20;
    const condB = rec.max_cond_temp_c ?? 60;
    const tcMin = Math.min(condA, condB);
    const tcMax = Math.max(condA, condB);

    // Margem: quanto o ponto está dentro do envelope (positivo = dentro)
    const teMargin = Math.min(te - teMin, teMax - te);
    const tcMargin = Math.min(tc - tcMin, tcMax - tc);
    const margin = teMargin + tcMargin * 0.5;

    // Bonus por qualidade de dados
    const qualityBonus =
      rec.data_quality === "validated" ? 100 :
      rec.data_quality === "check_required" ? 50 : 0;

    // Bonus por fonte
    const sourceBonus =
      (rec.source ?? "").startsWith("UNILAB") ? 20 :
      (rec.source ?? "").startsWith("VAPCYC") ? 15 : 0;

    return {
      idx,
      score: (envelope.inside ? 1000 : 0) + margin + qualityBonus + sourceBonus,
      inside: envelope.inside,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return { record: candidates[best.idx], index: best.idx };
}

// ─── API principal ────────────────────────────────────────────────────────────

/**
 * Seleciona o melhor registro de compressor para o ponto de operação e avalia
 * a capacidade e potência nesse ponto.
 *
 * @param candidates - Registros do mesmo modelo (ou modelos candidatos)
 * @param te - Temperatura de evaporação desejada (°C)
 * @param tc - Temperatura de condensação desejada (°C)
 * @returns Resultado completo com capacidade, potência, COP e avisos
 */
export function selectAndEvaluateCompressor(
  candidates: CompressorRecord[],
  te: number,
  tc: number
): CompressorSelectionResult {
  const { record, index } = selectBestCompressorRecord(candidates, te, tc);
  const evaluation = evaluateCompressorAtPoint(record, te, tc);
  return { evaluation, candidates, selected_index: index };
}

/**
 * Avalia um único registro de compressor em múltiplos pontos de operação.
 * Útil para gerar mapas de desempenho e curvas de capacidade.
 *
 * @param record - Registro do compressor
 * @param points - Array de pontos {te, tc}
 * @returns Array de resultados de avaliação
 */
export function evaluateCompressorMap(
  record: CompressorRecord,
  points: Array<{ te: number; tc: number }>
): CompressorEvalResult[] {
  return points.map(({ te, tc }) => evaluateCompressorAtPoint(record, te, tc));
}

/**
 * Gera uma grade de pontos de operação para mapa de desempenho.
 *
 * @param teRange - [min, max, step] para temperatura de evaporação
 * @param tcRange - [min, max, step] para temperatura de condensação
 */
export function generateOperatingGrid(
  teRange: [number, number, number],
  tcRange: [number, number, number]
): Array<{ te: number; tc: number }> {
  const [teMin, teMax, teStep] = teRange;
  const [tcMin, tcMax, tcStep] = tcRange;
  const points: Array<{ te: number; tc: number }> = [];

  for (let te = teMin; te <= teMax + 1e-9; te += teStep) {
    for (let tc = tcMin; tc <= tcMax + 1e-9; tc += tcStep) {
      points.push({
        te: Math.round(te * 10) / 10,
        tc: Math.round(tc * 10) / 10,
      });
    }
  }
  return points;
}
