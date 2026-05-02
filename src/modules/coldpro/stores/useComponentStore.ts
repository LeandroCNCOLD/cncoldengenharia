import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CompressorSpec,
  CondenserSpec,
  FanSpec,
  ExpansionValveSpec,
  FourWayValveSpec,
  ProgressiveCoilInput,
  DripTrayCoilInput,
  AgroCycleInput,
  ReheatCoilSizingInput,
  DefrostCycleInput,
  FrostFormationInput,
  SystemComponentsInput,
} from "@/modules/coldpro_v2";

export interface SavedCompressor {
  id: string;
  name: string;
  spec: CompressorSpec;
  createdAt: string;
}

export interface SavedCoil {
  id: string;
  name: string;
  role: "evaporator" | "condenser_coil" | "reheat";
  spec: ProgressiveCoilInput;
  createdAt: string;
}

export interface SavedCondenser {
  id: string;
  name: string;
  spec: CondenserSpec;
  createdAt: string;
}

export interface SavedFan {
  id: string;
  name: string;
  role: "evaporator_fan" | "condenser_fan";
  spec: FanSpec;
  createdAt: string;
}

export interface SavedExpansionValve {
  id: string;
  name: string;
  spec: ExpansionValveSpec;
  createdAt: string;
}

export interface SavedFourWayValve {
  id: string;
  name: string;
  spec: FourWayValveSpec;
  createdAt: string;
}

export interface SavedDripTrayCoil {
  id: string;
  name: string;
  spec: DripTrayCoilInput;
  createdAt: string;
}

export interface SavedDefrostConfig {
  id: string;
  name: string;
  spec: DefrostCycleInput;
  createdAt: string;
}

export interface SavedAgroConfig {
  id: string;
  name: string;
  spec: AgroCycleInput;
  createdAt: string;
}

export interface SavedReheatCoil {
  id: string;
  name: string;
  spec: ReheatCoilSizingInput;
  createdAt: string;
}

export interface SavedFrostConfig {
  id: string;
  name: string;
  spec: FrostFormationInput;
  createdAt: string;
}

export interface EquipmentAssembly {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  compressorId?: string;
  evaporatorCoilId?: string;
  condenserId?: string;
  evaporatorFanId?: string;
  condenserFanId?: string;
  expansionValveId?: string;
  fourWayValveId?: string;
  dripTrayCoilId?: string;
  defrostConfigId?: string;
  agroConfigId?: string;
  reheatCoilId?: string;
  frostConfigId?: string;
  systemConditions: {
    ambient_temp_c: number;
    required_airflow_m3_h: number;
  };
}

interface ComponentStore {
  compressors: SavedCompressor[];
  coils: SavedCoil[];
  condensers: SavedCondenser[];
  fans: SavedFan[];
  expansionValves: SavedExpansionValve[];
  fourWayValves: SavedFourWayValve[];
  dripTrayCoils: SavedDripTrayCoil[];
  defrostConfigs: SavedDefrostConfig[];
  agroConfigs: SavedAgroConfig[];
  reheatCoils: SavedReheatCoil[];
  frostConfigs: SavedFrostConfig[];
  assemblies: EquipmentAssembly[];

  addCompressor: (name: string, spec: CompressorSpec) => string;
  updateCompressor: (id: string, spec: CompressorSpec) => void;
  deleteCompressor: (id: string) => void;

  addCoil: (name: string, role: SavedCoil["role"], spec: ProgressiveCoilInput) => string;
  updateCoil: (id: string, spec: ProgressiveCoilInput) => void;
  deleteCoil: (id: string) => void;

  addCondenser: (name: string, spec: CondenserSpec) => string;
  updateCondenser: (id: string, spec: CondenserSpec) => void;
  deleteCondenser: (id: string) => void;

  addFan: (name: string, role: SavedFan["role"], spec: FanSpec) => string;
  updateFan: (id: string, spec: FanSpec) => void;
  deleteFan: (id: string) => void;

  addExpansionValve: (name: string, spec: ExpansionValveSpec) => string;
  updateExpansionValve: (id: string, spec: ExpansionValveSpec) => void;
  deleteExpansionValve: (id: string) => void;

  addFourWayValve: (name: string, spec: FourWayValveSpec) => string;
  updateFourWayValve: (id: string, spec: FourWayValveSpec) => void;
  deleteFourWayValve: (id: string) => void;

  addDripTrayCoil: (name: string, spec: DripTrayCoilInput) => string;
  updateDripTrayCoil: (id: string, spec: DripTrayCoilInput) => void;
  deleteDripTrayCoil: (id: string) => void;

  addDefrostConfig: (name: string, spec: DefrostCycleInput) => string;
  updateDefrostConfig: (id: string, spec: DefrostCycleInput) => void;
  deleteDefrostConfig: (id: string) => void;

  addAgroConfig: (name: string, spec: AgroCycleInput) => string;
  updateAgroConfig: (id: string, spec: AgroCycleInput) => void;
  deleteAgroConfig: (id: string) => void;

  addReheatCoil: (name: string, spec: ReheatCoilSizingInput) => string;
  updateReheatCoil: (id: string, spec: ReheatCoilSizingInput) => void;
  deleteReheatCoil: (id: string) => void;

  addFrostConfig: (name: string, spec: FrostFormationInput) => string;
  updateFrostConfig: (id: string, spec: FrostFormationInput) => void;
  deleteFrostConfig: (id: string) => void;

  addAssembly: (assembly: Omit<EquipmentAssembly, "id" | "createdAt">) => string;
  updateAssembly: (id: string, updates: Partial<EquipmentAssembly>) => void;
  deleteAssembly: (id: string) => void;

  buildSystemInput: (assemblyId: string) => SystemComponentsInput | null;
}

const now = () => new Date().toISOString();
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useComponentStore = create<ComponentStore>()(
  persist(
    (set, get) => ({
      compressors: [],
      coils: [],
      condensers: [],
      fans: [],
      expansionValves: [],
      fourWayValves: [],
      dripTrayCoils: [],
      defrostConfigs: [],
      agroConfigs: [],
      reheatCoils: [],
      frostConfigs: [],
      assemblies: [],

      addCompressor: (name, spec) => {
        const id = newId();
        set((s) => ({
          compressors: [...s.compressors, { id, name, spec, createdAt: now() }],
        }));
        return id;
      },
      updateCompressor: (id, spec) =>
        set((s) => ({
          compressors: s.compressors.map((c) => (c.id === id ? { ...c, spec } : c)),
        })),
      deleteCompressor: (id) =>
        set((s) => ({ compressors: s.compressors.filter((c) => c.id !== id) })),

      addCoil: (name, role, spec) => {
        const id = newId();
        set((s) => ({
          coils: [...s.coils, { id, name, role, spec, createdAt: now() }],
        }));
        return id;
      },
      updateCoil: (id, spec) =>
        set((s) => ({ coils: s.coils.map((c) => (c.id === id ? { ...c, spec } : c)) })),
      deleteCoil: (id) => set((s) => ({ coils: s.coils.filter((c) => c.id !== id) })),

      addCondenser: (name, spec) => {
        const id = newId();
        set((s) => ({
          condensers: [...s.condensers, { id, name, spec, createdAt: now() }],
        }));
        return id;
      },
      updateCondenser: (id, spec) =>
        set((s) => ({
          condensers: s.condensers.map((c) => (c.id === id ? { ...c, spec } : c)),
        })),
      deleteCondenser: (id) =>
        set((s) => ({ condensers: s.condensers.filter((c) => c.id !== id) })),

      addFan: (name, role, spec) => {
        const id = newId();
        set((s) => ({
          fans: [...s.fans, { id, name, role, spec, createdAt: now() }],
        }));
        return id;
      },
      updateFan: (id, spec) =>
        set((s) => ({ fans: s.fans.map((f) => (f.id === id ? { ...f, spec } : f)) })),
      deleteFan: (id) => set((s) => ({ fans: s.fans.filter((f) => f.id !== id) })),

      addExpansionValve: (name, spec) => {
        const id = newId();
        set((s) => ({
          expansionValves: [
            ...s.expansionValves,
            { id, name, spec, createdAt: now() },
          ],
        }));
        return id;
      },
      updateExpansionValve: (id, spec) =>
        set((s) => ({
          expansionValves: s.expansionValves.map((v) =>
            v.id === id ? { ...v, spec } : v,
          ),
        })),
      deleteExpansionValve: (id) =>
        set((s) => ({
          expansionValves: s.expansionValves.filter((v) => v.id !== id),
        })),

      addFourWayValve: (name, spec) => {
        const id = newId();
        set((s) => ({
          fourWayValves: [
            ...s.fourWayValves,
            { id, name, spec, createdAt: now() },
          ],
        }));
        return id;
      },
      updateFourWayValve: (id, spec) =>
        set((s) => ({
          fourWayValves: s.fourWayValves.map((v) =>
            v.id === id ? { ...v, spec } : v,
          ),
        })),
      deleteFourWayValve: (id) =>
        set((s) => ({
          fourWayValves: s.fourWayValves.filter((v) => v.id !== id),
        })),

      addDripTrayCoil: (name, spec) => {
        const id = newId();
        set((s) => ({
          dripTrayCoils: [
            ...s.dripTrayCoils,
            { id, name, spec, createdAt: now() },
          ],
        }));
        return id;
      },
      updateDripTrayCoil: (id, spec) =>
        set((s) => ({
          dripTrayCoils: s.dripTrayCoils.map((c) =>
            c.id === id ? { ...c, spec } : c,
          ),
        })),
      deleteDripTrayCoil: (id) =>
        set((s) => ({
          dripTrayCoils: s.dripTrayCoils.filter((c) => c.id !== id),
        })),

      addDefrostConfig: (name, spec) => {
        const id = newId();
        set((s) => ({
          defrostConfigs: [
            ...s.defrostConfigs,
            { id, name, spec, createdAt: now() },
          ],
        }));
        return id;
      },
      updateDefrostConfig: (id, spec) =>
        set((s) => ({
          defrostConfigs: s.defrostConfigs.map((c) =>
            c.id === id ? { ...c, spec } : c,
          ),
        })),
      deleteDefrostConfig: (id) =>
        set((s) => ({
          defrostConfigs: s.defrostConfigs.filter((c) => c.id !== id),
        })),

      addAgroConfig: (name, spec) => {
        const id = newId();
        set((s) => ({
          agroConfigs: [
            ...s.agroConfigs,
            { id, name, spec, createdAt: now() },
          ],
        }));
        return id;
      },
      updateAgroConfig: (id, spec) =>
        set((s) => ({
          agroConfigs: s.agroConfigs.map((c) => (c.id === id ? { ...c, spec } : c)),
        })),
      deleteAgroConfig: (id) =>
        set((s) => ({
          agroConfigs: s.agroConfigs.filter((c) => c.id !== id),
        })),

      addReheatCoil: (name, spec) => {
        const id = newId();
        set((s) => ({
          reheatCoils: [
            ...s.reheatCoils,
            { id, name, spec, createdAt: now() },
          ],
        }));
        return id;
      },
      updateReheatCoil: (id, spec) =>
        set((s) => ({
          reheatCoils: s.reheatCoils.map((c) => (c.id === id ? { ...c, spec } : c)),
        })),
      deleteReheatCoil: (id) =>
        set((s) => ({
          reheatCoils: s.reheatCoils.filter((c) => c.id !== id),
        })),

      addFrostConfig: (name, spec) => {
        const id = newId();
        set((s) => ({
          frostConfigs: [
            ...s.frostConfigs,
            { id, name, spec, createdAt: now() },
          ],
        }));
        return id;
      },
      updateFrostConfig: (id, spec) =>
        set((s) => ({
          frostConfigs: s.frostConfigs.map((c) =>
            c.id === id ? { ...c, spec } : c,
          ),
        })),
      deleteFrostConfig: (id) =>
        set((s) => ({
          frostConfigs: s.frostConfigs.filter((c) => c.id !== id),
        })),

      addAssembly: (assembly) => {
        const id = newId();
        set((s) => ({
          assemblies: [...s.assemblies, { ...assembly, id, createdAt: now() }],
        }));
        return id;
      },
      updateAssembly: (id, updates) =>
        set((s) => ({
          assemblies: s.assemblies.map((a) =>
            a.id === id ? { ...a, ...updates } : a,
          ),
        })),
      deleteAssembly: (id) =>
        set((s) => ({ assemblies: s.assemblies.filter((a) => a.id !== id) })),

      buildSystemInput: (assemblyId) => {
        const {
          assemblies,
          compressors,
          coils,
          condensers,
          fans,
          expansionValves,
          fourWayValves,
        } = get();
        const assembly = assemblies.find((a) => a.id === assemblyId);
        if (!assembly) return null;

        const compressor = compressors.find((c) => c.id === assembly.compressorId);
        const evaporatorCoil = coils.find(
          (c) => c.id === assembly.evaporatorCoilId,
        );
        const condenser = condensers.find((c) => c.id === assembly.condenserId);

        if (!compressor || !evaporatorCoil || !condenser) return null;

        const evaporatorFan = fans.find((f) => f.id === assembly.evaporatorFanId);
        const condenserFan = fans.find((f) => f.id === assembly.condenserFanId);
        const expansionValve = expansionValves.find(
          (v) => v.id === assembly.expansionValveId,
        );
        const fourWayValve = fourWayValves.find(
          (v) => v.id === assembly.fourWayValveId,
        );

        const input: SystemComponentsInput = {
          compressor: compressor.spec,
          evaporator: { progressive_input: evaporatorCoil.spec },
          condenser: condenser.spec,
          system_conditions: assembly.systemConditions,
          ...(evaporatorFan ? { evaporator_fan: evaporatorFan.spec } : {}),
          ...(condenserFan ? { condenser_fan: condenserFan.spec } : {}),
          ...(expansionValve ? { expansion_valve: expansionValve.spec } : {}),
          ...(fourWayValve ? { four_way_valve: fourWayValve.spec } : {}),
        };
        return input;
      },
    }),
    { name: "coldpro-component-store" },
  ),
);
