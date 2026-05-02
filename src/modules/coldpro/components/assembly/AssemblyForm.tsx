import { useState } from "react";
import { TechnicalField } from "../ui/TechnicalField";
import { AssemblyComponentSelector } from "./AssemblyComponentSelector";
import { useComponentStore } from "../../stores/useComponentStore";
import type { EquipmentAssembly } from "../../stores/useComponentStore";

interface AssemblyFormProps {
  onSaved: () => void;
}

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function AssemblyForm({ onSaved }: AssemblyFormProps) {
  const store = useComponentStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [compressorId, setCompressorId] = useState<string | undefined>();
  const [evaporatorCoilId, setEvaporatorCoilId] = useState<string | undefined>();
  const [condenserId, setCondenserId] = useState<string | undefined>();
  const [evaporatorFanId, setEvaporatorFanId] = useState<string | undefined>();
  const [condenserFanId, setCondenserFanId] = useState<string | undefined>();
  const [expansionValveId, setExpansionValveId] = useState<string | undefined>();
  const [fourWayValveId, setFourWayValveId] = useState<string | undefined>();
  const [dripTrayCoilId, setDripTrayCoilId] = useState<string | undefined>();
  const [defrostConfigId, setDefrostConfigId] = useState<string | undefined>();
  const [agroConfigId, setAgroConfigId] = useState<string | undefined>();
  const [reheatCoilId, setReheatCoilId] = useState<string | undefined>();
  const [frostConfigId, setFrostConfigId] = useState<string | undefined>();
  const [ambientTemp, setAmbientTemp] = useState(32);
  const [airflow, setAirflow] = useState(4000);

  const evaporatorCoils = store.coils.filter((c) => c.role === "evaporator");
  const condenserCoils = store.coils.filter((c) => c.role === "condenser_coil");
  void condenserCoils;
  const evaporatorFans = store.fans.filter((f) => f.role === "evaporator_fan");
  const condenserFans = store.fans.filter((f) => f.role === "condenser_fan");

  const canSave =
    name.trim().length > 0 &&
    !!compressorId &&
    !!evaporatorCoilId &&
    !!condenserId &&
    airflow > 0;

  const handleSave = () => {
    if (!canSave) return;
    const payload: Omit<EquipmentAssembly, "id" | "createdAt"> = {
      name: name.trim(),
      description: description.trim() || undefined,
      compressorId,
      evaporatorCoilId,
      condenserId,
      evaporatorFanId,
      condenserFanId,
      expansionValveId,
      fourWayValveId,
      dripTrayCoilId,
      defrostConfigId,
      agroConfigId,
      reheatCoilId,
      frostConfigId,
      systemConditions: {
        ambient_temp_c: ambientTemp,
        required_airflow_m3_h: airflow,
      },
    };
    store.addAssembly(payload);
    onSaved();
  };

  return (
    <div className="space-y-6">
      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          Identificação
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TechnicalField
            label="Nome do equipamento"
            value={name}
            onChange={(v) => setName(v)}
            type="text"
            placeholder="Ex: Sistema A — Câmara 1"
            required
          />
          <TechnicalField
            label="Descrição (opcional)"
            value={description}
            onChange={(v) => setDescription(v)}
            type="text"
            placeholder="Ex: Câmara de resfriados 0–4°C"
          />
        </div>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          Componentes principais
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AssemblyComponentSelector
            label="Compressor"
            required
            options={store.compressors}
            value={compressorId}
            onChange={setCompressorId}
            emptyHint="Cadastre um compressor primeiro."
          />
          <AssemblyComponentSelector
            label="Serpentina evaporadora"
            required
            options={evaporatorCoils}
            value={evaporatorCoilId}
            onChange={setEvaporatorCoilId}
            emptyHint="Cadastre uma serpentina com função 'Evaporador'."
          />
          <AssemblyComponentSelector
            label="Condensador"
            required
            options={store.condensers}
            value={condenserId}
            onChange={setCondenserId}
            emptyHint="Cadastre um condensador primeiro."
          />
          <AssemblyComponentSelector
            label="Válvula de expansão"
            options={store.expansionValves}
            value={expansionValveId}
            onChange={setExpansionValveId}
          />
        </div>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          Ventiladores e válvulas auxiliares
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AssemblyComponentSelector
            label="Ventilador do evaporador"
            options={evaporatorFans}
            value={evaporatorFanId}
            onChange={setEvaporatorFanId}
          />
          <AssemblyComponentSelector
            label="Ventilador do condensador"
            options={condenserFans}
            value={condenserFanId}
            onChange={setCondenserFanId}
          />
          <AssemblyComponentSelector
            label="Válvula 4 vias"
            options={store.fourWayValves}
            value={fourWayValveId}
            onChange={setFourWayValveId}
          />
          <AssemblyComponentSelector
            label="Serpentina de bandeja"
            options={store.dripTrayCoils}
            value={dripTrayCoilId}
            onChange={setDripTrayCoilId}
          />
        </div>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          Ciclos e configurações
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AssemblyComponentSelector
            label="Configuração de degelo"
            options={store.defrostConfigs}
            value={defrostConfigId}
            onChange={setDefrostConfigId}
          />
          <AssemblyComponentSelector
            label="Configuração AGRO / desumidificação"
            options={store.agroConfigs}
            value={agroConfigId}
            onChange={setAgroConfigId}
          />
          <AssemblyComponentSelector
            label="Bateria de reaquecimento"
            options={store.reheatCoils}
            value={reheatCoilId}
            onChange={setReheatCoilId}
          />
          <AssemblyComponentSelector
            label="Configuração de formação de gelo"
            options={store.frostConfigs}
            value={frostConfigId}
            onChange={setFrostConfigId}
          />
        </div>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-slate-700">
          Condições do sistema
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TechnicalField
            label="Temperatura ambiente"
            value={ambientTemp}
            onChange={(v) => setAmbientTemp(num(v))}
            type="number"
            unit="°C"
            required
          />
          <TechnicalField
            label="Vazão de ar requerida"
            value={airflow}
            onChange={(v) => setAirflow(num(v))}
            type="number"
            unit="m³/h"
            required
          />
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md bg-[#1E6FD9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Salvar Equipamento
      </button>
    </div>
  );
}
