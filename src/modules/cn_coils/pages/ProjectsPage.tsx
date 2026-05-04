import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Clock,
  FolderOpen,
  Search,
  Share2,
  Snowflake,
  Thermometer,
  Wind,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";

import {
  getProjectRoute,
  restoreProjectSnapshot,
  useProjectStore,
  type SavedProject,
} from "../store/useProjectStore";
import { buildShareUrl } from "../hooks/useShareableLink";

// ── Constantes ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<SavedProject["type"], string> = {
  cold_room: "Câmara Fria",
  dx_complete: "DX Completo",
  heat_pump: "Bomba de Calor",
  component_workspace: "Workspace",
};

type SortKey = "updatedAt" | "createdAt" | "name";
type FilterType = "all" | SavedProject["type"];

// ── Componentes auxiliares ────────────────────────────────────────────────────

function ProjectIcon({ type }: { type: SavedProject["type"] }) {
  if (type === "cold_room") return <Snowflake className="h-4 w-4 text-blue-500" />;
  if (type === "dx_complete") return <Wind className="h-4 w-4 text-cyan-500" />;
  if (type === "heat_pump") return <Thermometer className="h-4 w-4 text-orange-500" />;
  return <Wrench className="h-4 w-4 text-slate-500" />;
}

function TypeCard({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-lg border p-4 text-sm hover:bg-muted/50 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function ProjectsPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const saveProject = useProjectStore((s) => s.saveProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  // UI state
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Feature H — busca, filtro, sort
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let list = [...projects];

    // Filtro por tipo
    if (filterType !== "all") {
      list = list.filter((p) => p.type === filterType);
    }

    // Busca por nome
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Ordenação
    list.sort((a, b) => {
      let diff = 0;
      if (sortKey === "name") {
        diff = a.name.localeCompare(b.name, "pt-BR");
      } else {
        diff = a[sortKey] - b[sortKey];
      }
      return sortAsc ? diff : -diff;
    });

    return list;
  }, [projects, filterType, search, sortKey, sortAsc]);

  const openProject = (project: SavedProject) => {
    restoreProjectSnapshot(project);
    setActiveProject(project.id);
    if (project.type === "component_workspace") {
      navigate({ to: "/coldpro/cncoils/workspace", search: { type: "evaporator_dx" } as never });
      return;
    }
    navigate({ to: getProjectRoute(project) as never });
  };

  const createAndNavigate = (type: SavedProject["type"]) => {
    const id = saveProject(newName.trim() || TYPE_LABELS[type], type, {});
    const project = useProjectStore.getState().loadProject(id);
    setNewOpen(false);
    setNewName("");
    if (project) openProject(project);
  };

  const handleShare = async (project: SavedProject) => {
    try {
      const url = buildShareUrl(project);
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <PageContainer
      title="Meus Projetos"
      subtitle="Histórico local de projetos e simulações salvas"
      actions={<Button onClick={() => setNewOpen(true)}>＋ Novo Projeto</Button>}
    >
      {/* Aviso de limite */}
      {projects.length >= 45 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-3 text-sm text-amber-900 dark:text-amber-300">
            Você tem {projects.length} projetos salvos. O limite local é 50.
          </CardContent>
        </Card>
      )}

      {/* Feature H — Barra de busca + filtros + sort */}
      {projects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar projeto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>

          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="cold_room">Câmara Fria</SelectItem>
              <SelectItem value="dx_complete">DX Completo</SelectItem>
              <SelectItem value="heat_pump">Bomba de Calor</SelectItem>
              <SelectItem value="component_workspace">Workspace</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-9 w-[150px] text-sm">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Atualização
                </span>
              </SelectItem>
              <SelectItem value="createdAt">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Criação
                </span>
              </SelectItem>
              <SelectItem value="name">
                <span className="flex items-center gap-1">
                  <ArrowDownAZ className="h-3 w-3" /> Nome
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2"
            title={sortAsc ? "Ordem crescente" : "Ordem decrescente"}
            onClick={() => setSortAsc((v) => !v)}
          >
            {sortAsc ? (
              <ArrowUpAZ className="h-4 w-4" />
            ) : (
              <ArrowDownAZ className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {/* Lista de projetos */}
      {filtered.length === 0 && projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Nenhum projeto salvo</h2>
              <p className="text-sm text-muted-foreground">
                Crie um novo projeto ou inicie uma simulação e salve para retomar depois.
              </p>
            </div>
            <Button onClick={() => setNewOpen(true)}>＋ Novo Projeto</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum projeto encontrado para "{search}".
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <Card key={project.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  {renaming === project.id ? (
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          renameProject(project.id, renameValue.trim() || project.name);
                          setRenaming(null);
                        }
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className="truncate">{project.name}</span>
                  )}
                  <ProjectIcon type={project.type} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{TYPE_LABELS[project.type]}</Badge>
                  <Badge variant={project.snapshot.equilibriumResult ? "default" : "secondary"}>
                    {project.snapshot.equilibriumResult ? "✅ Equilíbrio calculado" : "⚙️ Em andamento"}
                  </Badge>
                  {(project.snapshot.attachments?.length ?? 0) > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      📎 {project.snapshot.attachments!.length} anexo(s)
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  <div>Criado: {new Date(project.createdAt).toLocaleString("pt-BR")}</div>
                  <div>Atualizado: {new Date(project.updatedAt).toLocaleString("pt-BR")}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openProject(project)}>
                    ▶ Abrir
                  </Button>
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
                  <Button
                    size="sm"
                    variant="outline"
                    title="Compartilhar projeto"
                    onClick={() => handleShare(project)}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Excluir o projeto "${project.name}"?`))
                        deleteProject(project.id);
                    }}
                  >
                    🗑️
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog novo projeto */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome do projeto"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createAndNavigate("component_workspace")}
          />
          <div className="grid grid-cols-2 gap-3">
            <TypeCard
              icon={<Snowflake />}
              label="Câmara Fria"
              onClick={() => createAndNavigate("cold_room")}
            />
            <TypeCard
              icon={<Wind />}
              label="DX Completo"
              onClick={() => createAndNavigate("dx_complete")}
            />
            <TypeCard
              icon={<Thermometer />}
              label="Bomba de Calor"
              onClick={() => createAndNavigate("heat_pump")}
            />
            <TypeCard
              icon={<Wrench />}
              label="Workspace de Componente"
              onClick={() => createAndNavigate("component_workspace")}
            />
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
