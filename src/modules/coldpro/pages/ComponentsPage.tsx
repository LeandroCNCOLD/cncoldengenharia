import { useState } from "react";
import {
  Cpu,
  Wind,
  Thermometer,
  Fan,
  Gauge,
  GitBranch,
  Droplets,
  Snowflake,
  Leaf,
  Zap,
  CloudSnow,
  Plus,
} from "lucide-react";
import type { ReactNode } from "react";

import { PageContainer } from "../components/layout/PageContainer";
import { CompressorForm } from "../components/components/CompressorForm";
import { CoilForm } from "../components/components/CoilForm";
import { CondenserForm } from "../components/components/CondenserForm";
import { FanForm } from "../components/components/FanForm";
import { ExpansionValveForm } from "../components/components/ExpansionValveForm";
import { FourWayValveForm } from "../components/components/FourWayValveForm";
import { DripTrayCoilForm } from "../components/components/DripTrayCoilForm";
import { DefrostConfigForm } from "../components/components/DefrostConfigForm";
import { AgroConfigForm } from "../components/components/AgroConfigForm";
import { ReheatCoilForm } from "../components/components/ReheatCoilForm";
import { FrostConfigForm } from "../components/components/FrostConfigForm";
import { ComponentCard } from "../components/components/ComponentCard";
import { CompressorLibraryBrowser } from "../components/components/CompressorLibraryBrowser";
import { FanLibraryBrowser } from "../components/components/FanLibraryBrowser";
import { useComponentStore } from "../stores/useComponentStore";

type ComponentTab =
  | "compressor"
  | "coil"
  | "condenser"
  | "fan"
  | "expansion_valve"
  | "four_way_valve"
  | "drip_tray"
  | "defrost"
  | "agro"
  | "reheat"
  | "frost";

interface SavedItem {
  id: string;
  name: string;
  createdAt: string;
  spec: object;
}

const TABS: {
  id: ComponentTab;
  label: string;
  icon: ReactNode;
  description: string;
}[] = [
  {
    id: "compressor",
    label: "Compressor",
    icon: <Cpu className="h-4 w-4" />,
    description: "Compressor frigorífico",
  },
  {
    id: "coil",
    label: "Serpentina",
    icon: <Wind className="h-4 w-4" />,
    description: "Aletado progressivo (evap/cond/reheat)",
  },
  {
    id: "condenser",
    label: "Condensador",
    icon: <Thermometer className="h-4 w-4" />,
    description: "Condensador a ar ou a água",
  },
  {
    id: "fan",
    label: "Ventilador",
    icon: <Fan className="h-4 w-4" />,
    description: "Ventilador de evaporador ou condensador",
  },
  {
    id: "expansion_valve",
    label: "Válvula Exp.",
    icon: <Gauge className="h-4 w-4" />,
    description: "Válvula de expansão",
  },
  {
    id: "four_way_valve",
    label: "Válvula 4 Vias",
    icon: <GitBranch className="h-4 w-4" />,
    description: "Válvula 4 vias (reversão de ciclo)",
  },
  {
    id: "drip_tray",
    label: "Serpentina Bandeja",
    icon: <Droplets className="h-4 w-4" />,
    description: "Subresfriamento e degelo da bandeja",
  },
  {
    id: "defrost",
    label: "Degelo",
    icon: <Snowflake className="h-4 w-4" />,
    description: "Configuração do ciclo de degelo",
  },
  {
    id: "agro",
    label: "AGRO / Desum.",
    icon: <Leaf className="h-4 w-4" />,
    description: "Ciclo AGRO com controle de umidade",
  },
  {
    id: "reheat",
    label: "Reaquecimento",
    icon: <Zap className="h-4 w-4" />,
    description: "Bateria de reaquecimento",
  },
  {
    id: "frost",
    label: "Formação de Gelo",
    icon: <CloudSnow className="h-4 w-4" />,
    description: "Modelo de formação de gelo",
  },
];

export function ComponentsPage() {
  const [activeTab, setActiveTab] = useState<ComponentTab>("compressor");
  const [showForm, setShowForm] = useState(false);
  const store = useComponentStore();

  const getList = (): SavedItem[] => {
    switch (activeTab) {
      case "compressor":
        return store.compressors;
      case "coil":
        return store.coils;
      case "condenser":
        return store.condensers;
      case "fan":
        return store.fans;
      case "expansion_valve":
        return store.expansionValves;
      case "four_way_valve":
        return store.fourWayValves;
      case "drip_tray":
        return store.dripTrayCoils;
      case "defrost":
        return store.defrostConfigs;
      case "agro":
        return store.agroConfigs;
      case "reheat":
        return store.reheatCoils;
      case "frost":
        return store.frostConfigs;
    }
  };

  const handleDelete = (id: string) => {
    switch (activeTab) {
      case "compressor":
        store.deleteCompressor(id);
        return;
      case "coil":
        store.deleteCoil(id);
        return;
      case "condenser":
        store.deleteCondenser(id);
        return;
      case "fan":
        store.deleteFan(id);
        return;
      case "expansion_valve":
        store.deleteExpansionValve(id);
        return;
      case "four_way_valve":
        store.deleteFourWayValve(id);
        return;
      case "drip_tray":
        store.deleteDripTrayCoil(id);
        return;
      case "defrost":
        store.deleteDefrostConfig(id);
        return;
      case "agro":
        store.deleteAgroConfig(id);
        return;
      case "reheat":
        store.deleteReheatCoil(id);
        return;
      case "frost":
        store.deleteFrostConfig(id);
        return;
    }
  };

  const renderForm = () => {
    const onSaved = () => setShowForm(false);
    switch (activeTab) {
      case "compressor":
        return <CompressorForm onSaved={onSaved} />;
      case "coil":
        return <CoilForm onSaved={onSaved} />;
      case "condenser":
        return <CondenserForm onSaved={onSaved} />;
      case "fan":
        return <FanForm onSaved={onSaved} />;
      case "expansion_valve":
        return <ExpansionValveForm onSaved={onSaved} />;
      case "four_way_valve":
        return <FourWayValveForm onSaved={onSaved} />;
      case "drip_tray":
        return <DripTrayCoilForm onSaved={onSaved} />;
      case "defrost":
        return <DefrostConfigForm onSaved={onSaved} />;
      case "agro":
        return <AgroConfigForm onSaved={onSaved} />;
      case "reheat":
        return <ReheatCoilForm onSaved={onSaved} />;
      case "frost":
        return <FrostConfigForm onSaved={onSaved} />;
    }
  };

  const activeTabInfo = TABS.find((t) => t.id === activeTab)!;
  const list = getList();

  return (
    <PageContainer
      title="Componentes"
      subtitle="Cadastre e dimensione componentes individuais antes de montar o equipamento."
      actions={
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-[#1E6FD9] px-4 py-2 text-sm text-white transition-colors hover:bg-[#1558b0]"
        >
          <Plus className="h-4 w-4" />
          Novo {activeTabInfo.label}
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-3">
          <ul className="space-y-0.5">
            {TABS.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowForm(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    activeTab === tab.id
                      ? "bg-[#1E6FD9] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="min-w-0">
          {showForm ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <header className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Novo {activeTabInfo.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {activeTabInfo.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-sm text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
              </header>
              {renderForm()}
            </div>
          ) : (
            <div className="space-y-4">
              {activeTab === "compressor" && <CompressorLibraryBrowser />}
              {activeTab === "fan" && <FanLibraryBrowser />}

              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {list.length}{" "}
                  {activeTabInfo.label.toLowerCase()}
                  {list.length !== 1 ? "s" : ""} cadastrado
                  {list.length !== 1 ? "s" : ""}
                </p>
              </div>

              {list.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((item) => (
                    <ComponentCard
                      key={item.id}
                      name={item.name}
                      type={activeTab}
                      spec={item.spec}
                      createdAt={item.createdAt}
                      onDelete={() => handleDelete(item.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-12 text-center">
                  <div className="mb-3 text-slate-300">
                    {activeTabInfo.icon}
                  </div>
                  <p className="text-sm text-slate-500">
                    Nenhum {activeTabInfo.label.toLowerCase()} cadastrado ainda.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="mt-3 text-sm text-[#1E6FD9] hover:underline"
                  >
                    Cadastrar o primeiro
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
