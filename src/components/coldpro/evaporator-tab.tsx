import { CoilTab } from "@/components/coldpro/coil-tab";

interface Props {
  equipmentProjectId: string;
}

export function EvaporatorTab({ equipmentProjectId }: Props) {
  return <CoilTab equipmentProjectId={equipmentProjectId} mode="evaporator" />;
}
