import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  captureEnvelopeSnapshot,
  useProjectStore,
  type SavedProject,
  type SavedProjectSnapshot,
} from "../store/useProjectStore";

interface SaveProjectButtonProps {
  type?: SavedProject["type"];
  projectType?: SavedProject["type"];
  defaultName: string;
  snapshot?: Partial<SavedProjectSnapshot>;
  systemInputs?: Record<string, unknown>;
  loadResult?: Record<string, unknown> | null;
  equilibriumResult?: SavedProjectSnapshot["equilibriumResult"];
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

export function SaveProjectButton({
  type,
  projectType,
  defaultName,
  snapshot,
  systemInputs,
  loadResult,
  equilibriumResult,
  variant = "outline",
  size = "sm",
}: SaveProjectButtonProps) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projectCount = useProjectStore((s) => s.projects.length);
  const saveProject = useProjectStore((s) => s.saveProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);

  const buildSnapshot = (): SavedProjectSnapshot => ({
    ...captureEnvelopeSnapshot(),
    systemInputs,
    loadResult,
    equilibriumResult,
    ...snapshot,
  });
  const resolvedType = type ?? projectType ?? "component_workspace";

  const handleSave = () => {
    if (activeProjectId) {
      updateProject(activeProjectId, buildSnapshot());
      toast.success("Projeto atualizado");
      return;
    }
    if (projectCount >= 50) {
      toast.error("Limite de 50 projetos salvos atingido.");
      return;
    }
    if (projectCount >= 45) {
      toast.warning("Você está próximo do limite de 50 projetos salvos.");
    }
    setName(defaultName);
    setOpen(true);
  };

  const confirmSave = () => {
    const trimmed = name.trim() || defaultName;
    saveProject(trimmed, resolvedType, buildSnapshot());
    setOpen(false);
    toast.success("Projeto salvo!");
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={handleSave}>
        💾 Salvar Projeto
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nome do projeto"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button className="w-full" onClick={confirmSave}>
              💾 Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
