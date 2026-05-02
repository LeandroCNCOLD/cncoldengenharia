import { useUnilabSimulationStore } from "../store/useUnilabSimulationStore";
import type {
  RefrigerantItem,
  UnilabComponentType,
} from "../types/unilab.types";
import { ptBR } from "../i18n/messages.ptBR";
import { NumberField } from "./NumberField";
import { SelectField } from "./SelectField";

interface ThermoFormProps {
  refrigerants: RefrigerantItem[];
  componentType: UnilabComponentType;
  disabled?: boolean;
}

function isCondenser(t: UnilabComponentType) {
  return t === "condenser_air" || t === "condenser_shell_tube";
}
function isEvaporator(t: UnilabComponentType) {
  return t === "evaporator_dx" || t === "evaporator_pumped";
}

export function ThermoForm({ refrigerants, componentType, disabled }: ThermoFormProps) {
  const thermo = useUnilabSimulationStore((s) => s.thermoInputs);
  const setThermo = useUnilabSimulationStore((s) => s.setThermoInputs);
  const f = ptBR.workspace.fields;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <SelectField
        label={f.refrigerant}
        value={thermo.refrigerantId}
        options={refrigerants.map((r) => ({
          value: r.id,
          label: `${r.name} (${r.kind === "pure" ? "puro" : "mistura"})`,
        }))}
        onChange={(v) => setThermo({ refrigerantId: v })}
        disabled={disabled}
      />

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={f.airFlow}
          unit="m³/h"
          value={thermo.airFlowM3H}
          onChange={(v) => setThermo({ airFlowM3H: v })}
          disabled={disabled}
        />
        <NumberField
          label={f.altitude}
          unit="m"
          value={thermo.altitudeM}
          onChange={(v) => setThermo({ altitudeM: v })}
          disabled={disabled}
        />
        <NumberField
          label={f.airInletTemp}
          unit="°C"
          value={thermo.airInletTempC}
          onChange={(v) => setThermo({ airInletTempC: v })}
          disabled={disabled}
        />
        <NumberField
          label={f.airInletRh}
          unit="%"
          min={0}
          max={100}
          value={thermo.airInletRhPercent}
          onChange={(v) => setThermo({ airInletRhPercent: v })}
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {isEvaporator(componentType) && (
          <>
            <NumberField
              label={f.evaporatingTemp}
              unit="°C"
              value={thermo.evaporatingTempC}
              onChange={(v) => setThermo({ evaporatingTempC: v })}
              disabled={disabled}
            />
            <NumberField
              label={f.superheat}
              unit="K"
              value={thermo.superheatK}
              onChange={(v) => setThermo({ superheatK: v })}
              disabled={disabled}
            />
          </>
        )}
        {isCondenser(componentType) && (
          <>
            <NumberField
              label={f.condensingTemp}
              unit="°C"
              value={thermo.condensingTempC}
              onChange={(v) => setThermo({ condensingTempC: v })}
              disabled={disabled}
            />
            <NumberField
              label={f.subcooling}
              unit="K"
              value={thermo.subcoolingK}
              onChange={(v) => setThermo({ subcoolingK: v })}
              disabled={disabled}
            />
          </>
        )}
      </div>
    </div>
  );
}
