import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/modules/coldpro/components/layout/PageContainer";
import { ComparisonBarChart } from "../components/ComparisonBarChart";
import { ComparisonRadarChart } from "../components/ComparisonRadarChart";
import { ComparisonTable } from "../components/ComparisonTable";
import { ComparisonPdfReport } from "../components/pdf/ComparisonPdfReport";
import { usePdfExport } from "../hooks/usePdfExport";
import { useProjectStore, type SavedProject } from "../store/useProjectStore";
import { projectTypeLabels } from "../utils/projectComparison";

export function ComparisonPage() {
  const projects = useProjectStore((state) => state.projects);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { isGenerating, exportPdf } = usePdfExport();

  const selectedProjects = useMemo(
    () => selectedIds
      .map((id) => projects.find((project) => project.id === id))
      .filter((project): project is SavedProject => Boolean(project)),
    [projects, selectedIds],
  );

  const comparableProjects = projects;

  const toggleProject = (project: SavedProject) => {
    setSelectedIds((current) => {
      if (current.includes(project.id)) return current.filter((id) => id !== project.id);
      if (current.length >= 4) return current;
      return [...current, project.id];
    });
  };

  return (
    <PageContainer
      title="Comparação de Sistemas"
      subtitle="Compare até 4 projetos salvos lado a lado"
      actions={
        <Button
          variant="outline"
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
          {isGenerating ? "⏳ Gerando PDF…" : "📄 Exportar Comparação PDF"}
        </Button>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Selecionar projetos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {comparableProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum projeto salvo ainda. Salve projetos nos sistemas para comparar.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {comparableProjects.map((project) => {
                  const selected = selectedIds.includes(project.id);
                  const disabled = !selected && selectedIds.length >= 4;
                  const hasEquilibrium = Boolean(project.snapshot.equilibriumResult);
                  return (
                    <button
                      key={project.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleProject(project)}
                      className={`rounded-lg border p-3 text-left text-sm transition ${
                        selected
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <div className="font-medium">{project.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {projectTypeLabels[project.type]}
                      </div>
                      <Badge className="mt-2" variant={hasEquilibrium ? "default" : "secondary"}>
                        {hasEquilibrium ? "✅ Equilíbrio calculado" : "⚠️ Equilíbrio não calculado"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Selecionados: {selectedProjects.length}/4
            </div>
          </CardContent>
        </Card>

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
    </PageContainer>
  );
}
