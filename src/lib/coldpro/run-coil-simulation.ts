/**
 * Roda a simulação de coil (evap/cond) a partir do registro do banco
 * e grava o resultado em `coil_simulations`. Usado tanto pelo botão manual
 * quanto pelo auto-simulate.
 */
import { Coil } from "@/modules/thermalcalc";
import type {
  CoilSimulatorInput,
  CoilSimulatorResult,
} from "@/modules/coldpro/coil/coilSimulatorTypes";
import {
  buildInputFromCoilRow,
} from "@/lib/coldpro/coil-row-mapper";
import {
  getEvaporatorCoilModel,
  getCondenserCoilModel,
} from "@/lib/coldpro/component-items";
import { saveCoilSimulatorRun } from "@/lib/coldpro/coil-simulations";

export type CoilKind = "evaporator" | "condenser";

export interface CoilRunOutcome {
  ok: boolean;
  result?: CoilSimulatorResult;
  input?: CoilSimulatorInput;
  reason?: string;
}

async function loadInput(
  componentItemId: string,
  kind: CoilKind,
): Promise<CoilSimulatorInput | null> {
  const row =
    kind === "evaporator"
      ? ((await getEvaporatorCoilModel(componentItemId)) as Record<string, unknown> | null)
      : ((await getCondenserCoilModel(componentItemId)) as Record<string, unknown> | null);
  return buildInputFromCoilRow(row, kind);
}

export async function runCoilSimulation(params: {
  equipmentProjectId: string;
  componentItemId: string;
  kind: CoilKind;
  userId?: string;
  label?: string;
}): Promise<CoilRunOutcome> {
  const input = await loadInput(params.componentItemId, params.kind);
  if (!input) return { ok: false, reason: "Modelo do coil não encontrado." };

  if (params.label) input.label = params.label;

  let result: CoilSimulatorResult;
  try {
    result =
      params.kind === "evaporator"
        ? Coil.simulateDxEvaporator(input, {})
        : Coil.simulateDxCondenser(input, {});
  } catch (e) {
    return { ok: false, reason: (e as Error).message ?? "Erro no solver." };
  }

  try {
    await saveCoilSimulatorRun({
      equipmentProjectId: params.equipmentProjectId,
      componentItemId: params.componentItemId,
      input,
      result,
      userId: params.userId,
    });
  } catch (e) {
    return {
      ok: true,
      result,
      input,
      reason: `Simulação ok, mas falhou ao gravar: ${(e as Error).message}`,
    };
  }

  return { ok: true, result, input };
}
