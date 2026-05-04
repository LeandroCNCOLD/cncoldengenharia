import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type NextStepKind = "condenser" | "compressor" | "simulation";

interface PostSaveNextStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  next: NextStepKind;
}

const CONFIG: Record<
  NextStepKind,
  { title: string; description: string; cta: string; to: string; search?: Record<string, string> }
> = {
  condenser: {
    title: "Projeto salvo!",
    description: "Deseja calcular o condensador agora para esta máquina?",
    cta: "Calcular condensador",
    to: "/coldpro/cncoils/workspace",
    search: { type: "condenser_air" },
  },
  compressor: {
    title: "Condensador salvo!",
    description: "Deseja seguir e calcular o compressor agora?",
    cta: "Calcular compressor",
    to: "/coldpro/cncoils/workspace",
    search: { type: "compressor" },
  },
  simulation: {
    title: "Compressor salvo!",
    description: "Deseja simular a máquina rodando (ciclo completo) agora?",
    cta: "Simular máquina",
    to: "/coldpro/cycle",
  },
};

export function PostSaveNextStepDialog({
  open,
  onOpenChange,
  next,
}: PostSaveNextStepDialogProps) {
  const navigate = useNavigate();
  const cfg = CONFIG[next];

  const handleGo = () => {
    onOpenChange(false);
    navigate({ to: cfg.to, search: cfg.search as never });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button onClick={handleGo}>{cfg.cta}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
