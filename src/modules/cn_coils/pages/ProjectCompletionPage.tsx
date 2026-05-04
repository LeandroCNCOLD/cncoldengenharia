/**
 * Feature K — ProjectCompletionPage
 * Página de conclusão de projeto: checklist de etapas, exportação PDF, compartilhamento.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Circle,
  Download,
  FileText,
  FolderOpen,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";

import { WorkspacePdfReport } from "../components/pdf/WorkspacePdfReport";
import { usePdfExport } from "../hooks/usePdfExport";
import { buildShareUrl } from "../hooks/useShareableLink";
import { useProjectStore, type SavedProject } from "../store/useProjectStore";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CompletionStep {
  id: string;
  label: string;
  description: string;
  check: (project: SavedProject) => boolean;
}

// ── Checklist de etapas ───────────────────────────────────────────────────────

const COMPLETION_STEPS: CompletionStep[] = [
  {
    id: "has_name",
    label: "Projeto nomeado",
    description: "O projeto possui um nome descritivo.",
    check: (p) => p.name.trim().length > 3,
  },
  {
    id: "has_inputs",
    label: "Parâmetros de entrada definidos",
    description: "Os parâmetros de entrada foram configurados.",
    check: (p) => Object.keys(p.snapshot).length > 0,
  },
  {
    id: "has_equilibrium",
    label: "Equilíbrio calculado",
    description: "O cálculo de equilíbrio foi executado com sucesso.",
    check: (p) => Boolean(p.snapshot.equilibriumResult),
  },
  {
    id: "has_compressor",
    label: "Compressor selecionado",
    description: "Um modelo de compressor foi selecionado.",
    check: (p) => Boolean(p.snapshot.compressorModel),
  },
  {
    id: "has_envelope",
    label: "Envelope gerado",
    description: "O envelope de operação foi calculado.",
    check: (p) =>
      Boolean(p.snapshot.compressorEnvelope) ||
      Boolean((p.snapshot as Record<string, unknown>).coilEnvelope),
  },
  {
    id: "has_attachments",
    label: "Documentação anexada",
    description: "Pelo menos um arquivo foi anexado ao projeto.",
    check: (p) => (p.snapshot.attachments?.length ?? 0) > 0,
  },
];

// ── Componente ────────────────────────────────────────────────────────────────

export function ProjectCompletionPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { isGenerating, exportPdf } = usePdfExport();
  const [selectedId, setSelectedId] = useState<string>(activeProjectId ?? "");

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const steps = useMemo(() => {
    if (!selectedProject) return [];
    return COMPLETION_STEPS.map((step) => ({
      ...step,
      done: step.check(selectedProject),
    }));
  }, [selectedProject]);

  const completedCount = steps.filter((s) => s.done).length;
  const completionPct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  const handleShare = async () => {
    if (!selectedProject) return;
    try {
      const url = buildShareUrl(selectedProject);
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleExportPdf = () => {
    if (!selectedProject) return;
    const snap = selectedProject.snapshot as Record<string, unknown>;
    exportPdf(
      <WorkspacePdfReport
        componentType="evaporator"
        title={`Relatório — ${selectedProject.name}`}
        projectName={selectedProject.name}
        inputs={
          (snap.inputs as Record<string, string | number>) ?? {}
        }
        results={
          (snap.equilibriumResult as Record<string, string | number>) ?? {}
        }
        warnings={[]}
        notes={[
          "Relatório gerado pela página de conclusão do projeto.",
          `Projeto do tipo: ${selectedProject.type}`,
        ]}
      />,
      `relatorio-${selectedProject.name.replace(/\s+/g, "-").toLowerCase()}.pdf`,
    );
  };

  return (
    <PageContainer
      title="Conclusão do Projeto"
      subtitle="Verifique as etapas concluídas e exporte o relatório final"
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/coldpro/projects" })}>
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
          Meus Projetos
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Seletor de projeto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Selecionar Projeto</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum projeto salvo. Crie um projeto primeiro.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`rounded-lg border p-3 text-left text-sm transition ${
                      selectedId === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedProject && (
          <>
            {/* Progresso geral */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>Progresso — {selectedProject.name}</span>
                  <Badge
                    variant={completionPct === 100 ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {completionPct}% concluído
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={completionPct} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {completedCount} de {steps.length} etapas concluídas
                </p>
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Checklist de Conclusão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 rounded-md p-2.5 ${
                      step.done ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/30"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          step.done ? "text-green-800 dark:text-green-300" : "text-foreground"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Ações finais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ações Finais</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    "⏳ Gerando…"
                  ) : (
                    <>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Exportar PDF
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={handleShare}>
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Compartilhar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate({ to: "/coldpro/projects" })
                  }
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Ver Projetos
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageContainer>
  );
}
