import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CoilEnvelope,
  CompressorEnvelopePoint,
  CondenserEnvelopePoint,
} from "./useCoilEnvelopeStore";
import { useCoilEnvelopeStore } from "./useCoilEnvelopeStore";
import type { SystemEquilibriumResult } from "../hooks/useSystemEquilibrium";

export type SavedProjectType =
  | "cold_room"
  | "dx_complete"
  | "heat_pump"
  | "component_workspace";

export interface SavedProjectSnapshot {
  evaporatorEnvelope?: CoilEnvelope | null;
  condenserEnvelope?: CondenserEnvelopePoint[] | CoilEnvelope | null;
  compressorEnvelope?: CompressorEnvelopePoint[] | null;
  compressorModel?: string | null;
  systemInputs?: Record<string, unknown>;
  equilibriumResult?: SystemEquilibriumResult | null;
  loadResult?: Record<string, unknown> | null;
}

export interface SavedProject {
  id: string;
  name: string;
  type: SavedProjectType;
  createdAt: number;
  updatedAt: number;
  snapshot: SavedProjectSnapshot;
}

interface ProjectStore {
  projects: SavedProject[];
  activeProjectId: string | null;
  saveProject: (
    name: string,
    type: SavedProjectType,
    snapshot: SavedProjectSnapshot,
  ) => string;
  updateProject: (id: string, snapshot: Partial<SavedProjectSnapshot>) => void;
  deleteProject: (id: string) => void;
  loadProject: (id: string) => SavedProject | null;
  setActiveProject: (id: string | null) => void;
  renameProject: (id: string, newName: string) => void;
}

const MAX_PROJECTS = 50;
const MAX_ENVELOPE_POINTS = 200;

function truncateArray<T>(value: T[] | null | undefined): T[] | null | undefined {
  if (!value) return value;
  return value.slice(0, MAX_ENVELOPE_POINTS);
}

function sanitizeSnapshot(snapshot: SavedProjectSnapshot): SavedProjectSnapshot {
  const evaporatorEnvelope = snapshot.evaporatorEnvelope
    ? {
        ...snapshot.evaporatorEnvelope,
        envelope: truncateArray(snapshot.evaporatorEnvelope.envelope) ?? [],
      }
    : snapshot.evaporatorEnvelope;
  const condenserEnvelope = Array.isArray(snapshot.condenserEnvelope)
    ? truncateArray(snapshot.condenserEnvelope)
    : snapshot.condenserEnvelope
      ? {
          ...snapshot.condenserEnvelope,
          envelope: truncateArray(snapshot.condenserEnvelope.envelope) ?? [],
        }
      : snapshot.condenserEnvelope;
  return {
    ...snapshot,
    evaporatorEnvelope,
    condenserEnvelope,
    compressorEnvelope: truncateArray(snapshot.compressorEnvelope),
  };
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      saveProject: (name, type, snapshot) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const cleanSnapshot = sanitizeSnapshot(snapshot);
        set((state) => ({
          projects: [
            ...state.projects.slice(Math.max(0, state.projects.length - (MAX_PROJECTS - 1))),
            {
              id,
              name: name.trim() || "Projeto sem nome",
              type,
              createdAt: now,
              updatedAt: now,
              snapshot: cleanSnapshot,
            },
          ],
          activeProjectId: id,
        }));
        return id;
      },
      updateProject: (id, snapshot) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? {
                  ...project,
                  snapshot: sanitizeSnapshot({ ...project.snapshot, ...snapshot }),
                  updatedAt: Date.now(),
                }
              : project,
          ),
        })),
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        })),
      loadProject: (id) => get().projects.find((project) => project.id === id) ?? null,
      setActiveProject: (id) => set({ activeProjectId: id }),
      renameProject: (id, newName) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, name: newName.trim() || project.name, updatedAt: Date.now() }
              : project,
          ),
        })),
    }),
    {
      name: "cncold-projects",
      version: 1,
    },
  ),
);

export function captureEnvelopeSnapshot(extra: Partial<SavedProjectSnapshot> = {}): SavedProjectSnapshot {
  const envelopeStore = useCoilEnvelopeStore.getState();
  return {
    evaporatorEnvelope: envelopeStore.envelopes.evaporator_dx ?? null,
    condenserEnvelope: envelopeStore.envelopes.condenser_air ?? envelopeStore.condenserEnvelope,
    compressorEnvelope: envelopeStore.compressorEnvelope,
    compressorModel: envelopeStore.compressorModel,
    ...extra,
  };
}

export function restoreProjectSnapshot(project: SavedProject): void {
  const { snapshot } = project;
  const envelopeStore = useCoilEnvelopeStore.getState();

  if (snapshot.evaporatorEnvelope && !Array.isArray(snapshot.evaporatorEnvelope)) {
    envelopeStore.saveEnvelope(snapshot.evaporatorEnvelope);
  }
  if (snapshot.condenserEnvelope) {
    if (Array.isArray(snapshot.condenserEnvelope)) {
      envelopeStore.setCondenserEnvelope(snapshot.condenserEnvelope);
    } else {
      envelopeStore.saveEnvelope(snapshot.condenserEnvelope);
    }
  }
  if (snapshot.compressorEnvelope) {
    envelopeStore.setCompressorEnvelope(
      snapshot.compressorEnvelope,
      "",
      snapshot.compressorModel ?? "Compressor salvo",
    );
  }
  useProjectStore.getState().setActiveProject(project.id);
}

export function getProjectRoute(project: SavedProject): string {
  const routes: Record<SavedProjectType, string> = {
    cold_room: "/coldpro/systems/cold-room",
    dx_complete: "/coldpro/systems/dx-complete",
    heat_pump: "/coldpro/systems/heat-pump",
    component_workspace: "/coldpro/cncoils/workspace",
  };
  return routes[project.type];
}
