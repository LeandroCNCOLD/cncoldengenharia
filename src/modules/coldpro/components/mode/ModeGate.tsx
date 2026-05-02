import type { ReactNode } from "react";
import { useUserModeStore } from "../../stores/useUserModeStore";
import type { UserMode } from "../../types/frontend.types";

const ORDER: Record<UserMode, number> = {
  basic: 0,
  intermediate: 1,
  professional: 2,
};

interface ModeGateProps {
  minMode: UserMode;
  fallback?: ReactNode;
  children: ReactNode;
}

export function ModeGate({ minMode, fallback = null, children }: ModeGateProps) {
  const current = useUserModeStore((s) => s.mode);
  if (ORDER[current] < ORDER[minMode]) return <>{fallback}</>;
  return <>{children}</>;
}
