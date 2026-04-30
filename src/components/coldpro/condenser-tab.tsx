import { CoilTab } from "@/components/coldpro/coil-tab";

interface Props {
  equipmentProjectId: string;
}

export function CondenserTab({ equipmentProjectId }: Props) {
  return <CoilTab equipmentProjectId={equipmentProjectId} mode="condenser" />;
}
