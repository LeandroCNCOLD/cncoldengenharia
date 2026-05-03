// Persistência local dos últimos inputs da simulação CN Coils.
// Não altera nenhuma lógica de cálculo — apenas snapshot/restore dos campos
// editáveis pelo usuário no formulário.

import { useCnCoilsSimulationStore } from "../store/useCnCoilsSimulationStore";

export const LAST_INPUTS_STORAGE_KEY = "cncoils_last_inputs";

interface LastInputsSnapshot {
  v: 1;
  savedAt: string;
  physicalInputs: ReturnType<typeof useCnCoilsSimulationStore.getState>["physicalInputs"];
  thermoInputs: ReturnType<typeof useCnCoilsSimulationStore.getState>["thermoInputs"];
  airFlow_m3h: number;
  tempInDB_C: number;
  rhIn_pct: number;
  fluid: string;
  fluidOperatingTemp_C: number;
  superheat_K: number;
  subcooling_K: number;
  errorFactorPercent: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function saveLastInputs(): void {
  if (!isBrowser()) return;
  try {
    const s = useCnCoilsSimulationStore.getState();
    const snap: LastInputsSnapshot = {
      v: 1,
      savedAt: new Date().toISOString(),
      physicalInputs: s.physicalInputs,
      thermoInputs: s.thermoInputs,
      airFlow_m3h: s.airFlow_m3h,
      tempInDB_C: s.tempInDB_C,
      rhIn_pct: s.rhIn_pct,
      fluid: s.fluid,
      fluidOperatingTemp_C: s.fluidOperatingTemp_C,
      superheat_K: s.superheat_K,
      subcooling_K: s.subcooling_K,
      errorFactorPercent: s.errorFactorPercent,
    };
    localStorage.setItem(LAST_INPUTS_STORAGE_KEY, JSON.stringify(snap));
  } catch (err) {
    console.warn("[cn_coils] Falha ao salvar últimos inputs:", err);
  }
}

export function hasSavedLastInputs(): boolean {
  if (!isBrowser()) return false;
  try {
    return !!localStorage.getItem(LAST_INPUTS_STORAGE_KEY);
  } catch {
    return false;
  }
}

export function restoreLastInputs(): boolean {
  if (!isBrowser()) return false;
  try {
    const raw = localStorage.getItem(LAST_INPUTS_STORAGE_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw) as Partial<LastInputsSnapshot>;
    if (!snap || snap.v !== 1) return false;
    const s = useCnCoilsSimulationStore.getState();
    if (snap.physicalInputs) s.setPhysicalInputs(snap.physicalInputs);
    if (snap.thermoInputs) s.setThermoInputs(snap.thermoInputs);
    if (Number.isFinite(snap.airFlow_m3h)) s.setAirFlow(snap.airFlow_m3h as number);
    if (Number.isFinite(snap.tempInDB_C)) s.setTempInDB(snap.tempInDB_C as number);
    if (Number.isFinite(snap.rhIn_pct)) s.setRhIn(snap.rhIn_pct as number);
    if (typeof snap.fluid === "string" && snap.fluid) s.setFluid(snap.fluid);
    if (Number.isFinite(snap.fluidOperatingTemp_C))
      s.setFluidOperatingTemp(snap.fluidOperatingTemp_C as number);
    if (Number.isFinite(snap.superheat_K)) s.setSuperheat(snap.superheat_K as number);
    if (Number.isFinite(snap.subcooling_K)) s.setSubcooling(snap.subcooling_K as number);
    if (Number.isFinite(snap.errorFactorPercent))
      s.setErrorFactorPercent(snap.errorFactorPercent as number);
    return true;
  } catch (err) {
    console.warn("[cn_coils] Falha ao restaurar últimos inputs:", err);
    return false;
  }
}
