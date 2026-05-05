import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, FolderOpen, Pencil, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useProjectStore,
  type ProjectHeader,
  type SavedProject,
  type SavedProjectType,
} from "../store/useProjectStore";

const STATUS_LABELS: Record<NonNullable<ProjectHeader["status"]>, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  approved: "Aprovado",
  released: "Liberado",
};

const STATUS_VARIANTS: Record<
  NonNullable<ProjectHeader["status"]>,
  "secondary" | "default" | "outline"
> = {
  draft: "secondary",
  review: "outline",
  approved: "default",
  released: "default",
};

type ProjectHeaderFormState = ProjectHeader & { name: string };

interface ProjectHeaderBarProps {
  workspaceType: SavedProjectType;
  onNovoAletado?: () => void;
}

function emptyForm(): ProjectHeaderFormState {
  return {
    name: "",
    clientName: "",
    projectCode: "",
    description: "",
    engineer: "",
    revision: "Rev. A",
    status: "draft",
    tags: [],
  };
}

export function ProjectHeaderBar({ workspaceType, onNovoAletado }: ProjectHeaderBarProps) {
  const navigate = useNavigate();
  const {
    projects,
    activeProjectId,
    saveProject,
    setActiveProject,
    updateProjectHeader,
  } = useProjectStore();

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const recentProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5),
    [projects],
  );
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [form, setForm] = useState<ProjectHeaderFormState>(emptyForm);

  const filteredCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    if (query.length < 2) return [];
    return projects.filter((project) => {
      const header = project.header;
      return (
        project.name.toLowerCase().includes(query) ||
        (header?.projectCode ?? "").toLowerCase().includes(query) ||
        (header?.clientName ?? "").toLowerCase().includes(query)
      );
    });
  }, [catalogSearch, projects]);

  function openNew() {
    setForm(emptyForm());
    setCatalogSearch("");
    setShowNewDialog(true);
  }

  function openEdit() {
    if (!activeProject) return;
    setForm({
      name: activeProject.name,
      clientName: activeProject.header?.clientName ?? "",
      projectCode: activeProject.header?.projectCode ?? "",
      description: activeProject.header?.description ?? "",
      engineer: activeProject.header?.engineer ?? "",
      revision: activeProject.header?.revision ?? "Rev. A",
      status: activeProject.header?.status ?? "draft",
      tags: activeProject.header?.tags ?? [],
    });
    setShowEditDialog(true);
  }

  function handleCreate() {
    const name = form.name.trim();
    if (!name) return;
    const { name: _name, ...header } = form;
    const id = saveProject(name, workspaceType, {});
    updateProjectHeader(id, header);
    setActiveProject(id);
    setShowNewDialog(false);
  }

  function handleSaveEdit() {
    if (!activeProjectId) return;
    const name = form.name.trim();
    const { name: _name, ...header } = form;
    if (name) useProjectStore.getState().renameProject(activeProjectId, name);
    updateProjectHeader(activeProjectId, header);
    setShowEditDialog(false);
  }

  function importFromCatalog(project: SavedProject) {
    setForm({
      name: `${project.name} (cópia)`,
      clientName: project.header?.clientName ?? "",
      projectCode: "",
      description: project.header?.description ?? "",
      engineer: project.header?.engineer ?? "",
      revision: "Rev. A",
      status: "draft",
      tags: project.header?.tags ?? [],
    });
    setCatalogSearch("");
  }

  function openCatalog() {
    void navigate({ to: "/coldpro/catalog" });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-sm">
        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />

        {activeProject ? (
          <>
            <div className="min-w-[220px] flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <FolderOpen className="h-3.5 w-3.5 text-primary" />
                {activeProject.header?.projectCode && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {activeProject.header.projectCode} ·
                  </span>
                )}
                <span className="truncate font-semibold text-foreground">
                  {activeProject.name}
                </span>
                <Badge
                  variant={STATUS_VARIANTS[activeProject.header?.status ?? "draft"]}
                  className="h-5 text-[10px]"
                >
                  {STATUS_LABELS[activeProject.header?.status ?? "draft"]}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {activeProject.header?.clientName && (
                  <span>Cliente: {activeProject.header.clientName}</span>
                )}
                {activeProject.header?.engineer && (
                  <span>Resp: {activeProject.header.engineer}</span>
                )}
                {activeProject.header?.revision && (
                  <span>{activeProject.header.revision}</span>
                )}
                <span>
                  Criado: {new Date(activeProject.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              title="Selecionar equipamento do catálogo CN Cold"
              onClick={openCatalog}
            >
              <Search className="h-3.5 w-3.5" />
              Catálogo
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={openEdit}>
              <Pencil className="h-3 w-3" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => setActiveProject(null)}
            >
              Fechar projeto
            </Button>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FolderOpen className="h-3.5 w-3.5" />
              Nenhum projeto ativo
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              title="Selecionar equipamento do catálogo CN Cold"
              onClick={openCatalog}
            >
              <Search className="h-3.5 w-3.5" />
              Catálogo
            </Button>
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" />
              Novo Projeto
            </Button>
            {recentProjects.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                    Abrir Projeto
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-64 w-72 overflow-y-auto">
                  {recentProjects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => setActiveProject(project.id)}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{project.name}</div>
                        {project.header?.clientName && (
                          <div className="text-xs text-muted-foreground">
                            {project.header.clientName}
                          </div>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Importar do Catálogo (opcional)
              </Label>
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="h-8 pl-7 text-xs"
                  placeholder="Buscar projeto por nome, código ou cliente..."
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                />
              </div>
              {filteredCatalog.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {filteredCatalog.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-left text-xs hover:bg-accent"
                      onClick={() => importFromCatalog(project)}
                    >
                      <span className="font-medium">{project.name}</span>
                      {project.header?.clientName && (
                        <span className="ml-2 text-muted-foreground">
                          {project.header.clientName}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ProjectHeaderForm form={form} onChange={setForm} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!form.name.trim()}>
              Criar Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Cabeçalho do Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <ProjectHeaderForm form={form} onChange={setForm} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectHeaderForm({
  form,
  onChange,
}: {
  form: ProjectHeaderFormState;
  onChange: (form: ProjectHeaderFormState) => void;
}) {
  const set = (key: keyof ProjectHeaderFormState, value: string) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Nome do Projeto *</Label>
        <Input
          className="h-8 text-xs"
          value={form.name}
          onChange={(event) => set("name", event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Código</Label>
        <Input
          className="h-8 font-mono text-xs"
          placeholder="CN-2025-042"
          value={form.projectCode ?? ""}
          onChange={(event) => set("projectCode", event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Status</Label>
        <Select
          value={form.status ?? "draft"}
          onValueChange={(value) => set("status", value)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="review">Em revisão</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="released">Liberado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Cliente</Label>
        <Input
          className="h-8 text-xs"
          value={form.clientName ?? ""}
          onChange={(event) => set("clientName", event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Responsável Técnico</Label>
        <Input
          className="h-8 text-xs"
          value={form.engineer ?? ""}
          onChange={(event) => set("engineer", event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Revisão</Label>
        <Input
          className="h-8 text-xs"
          placeholder="Rev. A"
          value={form.revision ?? ""}
          onChange={(event) => set("revision", event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Descrição</Label>
        <Input
          className="h-8 text-xs"
          value={form.description ?? ""}
          onChange={(event) => set("description", event.target.value)}
        />
      </div>
    </div>
  );
}
