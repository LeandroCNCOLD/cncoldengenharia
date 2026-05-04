import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FolderOpen, Snowflake, Thermometer, Wind, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import {
  getProjectRoute,
  restoreProjectSnapshot,
  useProjectStore,
  type SavedProject,
} from "../store/useProjectStore";

const labels: Record<SavedProject["type"], string> = {
  cold_room: "Câmara Fria",
  dx_complete: "DX Completo",
  heat_pump: "Bomba de Calor",
  component_workspace: "Workspace",
};

export function ProjectsPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const saveProject = useProjectStore((s) => s.saveProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const sorted = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt - a.updatedAt),
    [projects],
  );

  const openProject = (project: SavedProject) => {
    restoreProjectSnapshot(project);
    setActiveProject(project.id);
    if (project.type === "component_workspace") {
      navigate({
        to: "/coldpro/cncoils/workspace",
        search: { type: "evaporator_dx" } as never,
      });
      return;
    }
    navigate({ to: getProjectRoute(project) as never });
  };

  const createAndNavigate = (type: SavedProject["type"]) => {
    const id = saveProject(newName.trim() || labels[type], type, {});
    const project = useProjectStore.getState().loadProject(id);
    setNewOpen(false);
    setNewName("");
    if (project) openProject(project);
  };

  return (
    <PageContainer
      title="Meus Projetos"
      subtitle="Histórico local de projetos e simulações salvas"
      actions={<Button onClick={() => setNewOpen(true)}>＋ Novo Projeto</Button>}
    >
      {projects.length >= 45 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 text-sm text-amber-900">
            Você tem {projects.length} projetos salvos. O limite local é 50.
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <FolderOpen className="h-10 w-10 text-slate-400" />
            <div>
              <h2 className="text-lg font-semibold">Nenhum projeto salvo</h2>
              <p className="text-sm text-muted-foreground">
                Crie um novo projeto ou inicie uma simulação e salve para retomar depois.
              </p>
            </div>
            <Button onClick={() => setNewOpen(true)}>＋ Novo Projeto</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((project) => (
            <Card key={project.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  {renaming === project.id ? (
                    <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
                  ) : (
                    <span className="truncate">{project.name}</span>
                  )}
                  <ProjectIcon type={project.type} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{labels[project.type]}</Badge>
                  <Badge variant={project.snapshot.equilibriumResult ? "default" : "secondary"}>
                    {project.snapshot.equilibriumResult ? "✅ Equilíbrio calculado" : "⚙️ Em andamento"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  <div>Criado: {new Date(project.createdAt).toLocaleString("pt-BR")}</div>
                  <div>Atualizado: {new Date(project.updatedAt).toLocaleString("pt-BR")}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openProject(project)}>▶ Abrir</Button>
                  {renaming === project.id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        renameProject(project.id, renameValue.trim() || project.name);
                        setRenaming(null);
                      }}
                    >
                      Salvar nome
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRenaming(project.id);
                        setRenameValue(project.name);
                      }}
                    >
                      ✏️ Renomear
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled>📄 PDF</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Excluir o projeto "${project.name}"?`)) deleteProject(project.id);
                    }}
                  >
                    🗑️ Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome do projeto"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <TypeCard icon={<Snowflake />} label="Câmara Fria" onClick={() => createAndNavigate("cold_room")} />
            <TypeCard icon={<Wind />} label="DX Completo" onClick={() => createAndNavigate("dx_complete")} />
            <TypeCard icon={<Thermometer />} label="Bomba de Calor" onClick={() => createAndNavigate("heat_pump")} />
            <TypeCard icon={<Wrench />} label="Workspace de Componente" onClick={() => createAndNavigate("component_workspace")} />
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function ProjectIcon({ type }: { type: SavedProject["type"] }) {
  if (type === "cold_room") return <Snowflake className="h-4 w-4 text-blue-500" />;
  if (type === "dx_complete") return <Wind className="h-4 w-4 text-cyan-500" />;
  if (type === "heat_pump") return <Thermometer className="h-4 w-4 text-orange-500" />;
  return <Wrench className="h-4 w-4 text-slate-500" />;
}

function TypeCard({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-lg border p-4 text-sm hover:bg-slate-50"
    >
      {icon}
      {label}
    </button>
  );
}
