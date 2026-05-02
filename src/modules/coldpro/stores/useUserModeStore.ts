import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserMode } from "../types/frontend.types";

interface UserModeStore {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
}

export const useUserModeStore = create<UserModeStore>()(
  persist(
    (set) => ({
      mode: "basic",
      setMode: (mode) => set({ mode }),
    }),
    { name: "coldpro-user-mode" },
  ),
);
