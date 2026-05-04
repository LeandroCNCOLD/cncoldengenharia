import { useMemo, useState } from "react";
import { Eye, Scale, Share2, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";

import { ComparisonBarChart } from "../components/ComparisonBarChart";
import { ComparisonRadarChart } from "../components/ComparisonRadarChart";
import { ComparisonTable } from "../components/ComparisonTable";
import { ComparisonPdfReport } from "../components/pdf/ComparisonPdfReport";
import { usePdfExport } from "../hooks/usePdfExport";
import { buildShareUrl } from "../hooks/useShareableLink";
import { useProjectStore, type SavedProject } from "../store/useProjectStore";
import { projectTypeLabels } from "../utils/projectComparison";

// ── Utilitário: destaca o melhor valor numérico de uma lista ──────────────────

function getBestIndex(values: (number | undefined | null)[], higherIsBetter = true): number {
  const nums = values.map((v) => (typeof v === "number" ? v : null));
  if (nums.every((n) => n === null)) return -1;
  let bestIdx = -1;
  let bestVal = higherIsBetter ? -Infinity : Infinity;
  nums.forEach((n, i) => {
    if (n === null) return;
    if (higherIsBetter ? n > bestVal : n < bestVal) {
      bestVal = n;
      bestIdx = i;
    }
  });
  return bestIdx;
}

// ── Componente: card de seleção de projeto ────────────────────────────────────

function ProjectSelectCard({
  project,
  selected,
  disabled,
  onToggle,
  onDetail,
}: {
  project: SavedProject;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onDetail: () => void;
}) {
  const hasEquilibrium = Boolean(project.snapshot.equilibriumResult);
  return (
    <div
      className={`relative rounded-lg border p-3 text-sm transition ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:bg-muted/40"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className="block w-full text-left"
      >
        <div className="font-medium truncate pr-6">{project.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {projectTypeLabels[project.type]}
        </div>
        <Badge className="mt-2" variant={hasEquilibrium ? "default" : "secondary"}>
          {hasEquilibrium ? "✅ Equilíbrio calculado" : "⚠️ Sem equilíbrio"}
        </Badge>
      </button>
      {/* Botão de detalhe */}
      <button
        type="button"
        title="Ver detalhes"
        onClick={(e) => { e.stopPropagation(); onDetail(); }}
        className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Componente: modal de detalhes de projeto ──────────────────────────────────

function ProjectDetailModal({
  project,
  open,
  onClose,
}: {
  project: SavedProject | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!project) return null;
  const snap = project.snapshot;
  const eq = snap.equilibriumResult as Record<string, unknown> | null | undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            {project.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{projectTypeLabels[project.type]}</Badge>
            <Badge variant="secondary">
              Criado: {new Date(project.createdAt).toLocaleDateString("pt-BR")}
            </Badge>
          </div>
          {snap.compressorModel && (
            <p>
              <span className="text-muted-foreground">Compressor:</span>{" "}
              <span className="font-medium">{snap.compressorModel}</span>
            </p>
          )}
          {eq && (
            <div className="rounded-md bg-muted p-3 space-y-1">
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Resultado de Equilíbrio
              </p>
              {Object.entries(eq)
                .slice(0, 8)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono">{String(v)}</span>
                  </div>
                ))}
            </div>
          )}
          {!eq && (
            <p className="text-muted-foreground text-xs">
              Nenhum resultado de equilíbrio disponível para este projeto.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Componente: linha de tabela com highlight de melhor valor ─────────────────

interface HighlightRowProps {
  label: string;
  values: (number | string | null | undefined)[];
  bestIndex: number;
  unit?: string;
}

function HighlightRow({ label, values, bestIndex, unit }: HighlightRowProps) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-1.5 pr-3 text-xs text-muted-foreground">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`py-1.5 text-center text-xs font-mono ${
            i === bestIndex ? "font-bold text-primary" : ""
          }`}
        >
          {v != null ? `${v}${unit ?? ""}` : "—"}
        </td>
      ))}
    </tr>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function ComparisonPage() {
  const projects = useProjectStore((state) => state.projects);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { isGenerating, exportPdf } = usePdfExport();
  const [detailProject, setDetailProject] = useState<SavedProject | null>(null);

  const selectedProjects = useMemo(
    () =>
      selectedIds
        .map((id) => projects.find((p) => p.id === id))
        .filter((p): p is SavedProject => Boolean(p)),
    [projects, selectedIds],
  );

  const toggleProject = (project: SavedProject) => {
    setSelectedIds((cur) => {
      if (cur.includes(project.id)) return cur.filter((id) => id !== project.id);
      if (cur.length >= 4) return cur;
      return [...cur, project.id];
    });
  };

  const handleShare = async () => {
    if (selectedProjects.length === 0) return;
    // Compartilha o primeiro projeto selecionado como referência
    try {
      const url = buildShareUrl(selectedProjects[0]);
      await navigator.clipboard.writeText(url);
      toast.success("Link do projeto principal copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  // Highlight: COP máx (maior é melhor), W_kW (menor é melhor)
  const copValues = selectedProjects.map(
    (p) => (p.snapshot.equilibriumResult as Record<string, number> | null)?.COP ?? null,
  );
  const wValues = selectedProjects.map(
    (p) => (p.snapshot.equilibriumResult as Record<string, number> | null)?.W_kW ?? null,
  );
  const bestCopIdx = getBestIndex(copValues, true);
  const bestWIdx = getBestIndex(wValues, false);

  return (
    <PageContainer
      title="Comparação de Sistemas"
      subtitle="Compare até 4 projetos salvos lado a lado"
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={selectedProjects.length < 1}
            onClick={handleShare}
          >
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            Compartilhar
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedProjects.length < 2 || isGenerating}
            onClick={() =>
              exportPdf(
                <ComparisonPdfReport
                  projects={selectedProjects}
                  date={new Date().toLocaleString("pt-BR")}
                />,
                `comparacao-sistemas-${new Date().toISOString().slice(0, 10)}.pdf`,
              )
            }
          >
            {isGenerating ? "⏳ Gerando…" : "📄 PDF"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Seleção de projetos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Selecionar projetos
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {selectedProjects.length}/4 selecionados
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum projeto salvo ainda. Salve projetos nos sistemas para comparar.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {projects.map((project) => (
                  <ProjectSelectCard
                    key={project.id}
                    project={project}
                    selected={selectedIds.includes(project.id)}
                    disabled={!selectedIds.includes(project.id) && selectedIds.length >= 4}
                    onToggle={() => toggleProject(project)}
                    onDetail={() => setDetailProject(project)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Highlight de melhores valores */}
        {selectedProjects.length >= 2 && (copValues.some(Boolean) || wValues.some(Boolean)) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Destaque — Melhor desempenho{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (valores em negrito = melhor)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-1 text-left text-xs text-muted-foreground">Parâmetro</th>
                    {selectedProjects.map((p) => (
                      <th key={p.id} className="py-1 text-center text-xs font-medium truncate max-w-[80px]">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <HighlightRow
                    label="COP"
                    values={copValues}
                    bestIndex={bestCopIdx}
                  />
                  <HighlightRow
                    label="W (kW)"
                    values={wValues}
                    bestIndex={bestWIdx}
                    unit=" kW"
                  />
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {selectedProjects.length < 2 ? (
          <Alert>
            <AlertDescription>Selecione pelo menos 2 projetos para comparar.</AlertDescription>
          </Alert>
        ) : (
          <>
            <ComparisonTable projects={selectedProjects} />
            <ComparisonBarChart projects={selectedProjects} />
            <ComparisonRadarChart projects={selectedProjects} />
          </>
        )}
      </div>

      {/* Modal de detalhes */}
      <ProjectDetailModal
        project={detailProject}
        open={Boolean(detailProject)}
        onClose={() => setDetailProject(null)}
      />
    </PageContainer>
  );
}
