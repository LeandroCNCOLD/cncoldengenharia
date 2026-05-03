import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CoilSchematic } from "./CoilSchematic";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Modal que exibe o esquema visual da serpentina sob demanda. */
export function CoilSchematicModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Esquema da serpentina</DialogTitle>
        </DialogHeader>
        <CoilSchematic />
      </DialogContent>
    </Dialog>
  );
}
