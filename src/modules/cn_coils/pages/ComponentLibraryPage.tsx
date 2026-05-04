/**
 * Feature C — Biblioteca de Componentes
 * CRUD de geometrias e compressores extraídos de catálogos.
 */

import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BookOpen, Cpu, LayoutGrid, Trash2 } from "lucide-react";

import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { useExtractedDataStore, useExtractedDataSummary } from "../store/useExtractedDataStore";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const fmt = (v: number | undefined, d = 1) =>
  v !== undefined && Number.isFinite(v)
    ? v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ComponentLibraryPage() {
  const navigate = useNavigate();
  const { geometries, compressors, removeGeometry, removeCompressor } =
    useExtractedDataStore();
  const summary = useExtractedDataSummary();

  const handleUseGeometry = (id: string) => {
    // Navega para o workspace de evaporador DX; o workspace pode ler o id do store
    navigate({ to: "/coldpro/cncoils/workspace", search: { type: "evaporator_dx" } });
    toast.success("Geometria selecionada. Configure os parâmetros no workspace.");
    void id; // futuro: pre-fill via store action
  };

  const handleUseCompressor = (id: string) => {
    navigate({ to: "/coldpro/assembly" });
    toast.success("Compressor selecionado. Configure na bancada de testes.");
    void id;
  };

  const storageEstimateKB = Math.round(
    JSON.stringify({ geometries, compressors }).length / 1024,
  );

  const header = (
    <WorkspaceHeader
      title="Biblioteca de Componentes"
      icon={<BookOpen className="h-4 w-4" />}
      backTo="/coldpro/cncoils"
      backLabel="CN Coils"
    />
  );

  const sidebar = (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Resumo
        </p>
        <div className="mt-2 space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Geometrias:</span>{" "}
            <span className="font-medium">{summary.geometryCount}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Compressores:</span>{" "}
            <span className="font-medium">{summary.compressorCount}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Armazenamento:</span>{" "}
            <span className="font-medium">~{storageEstimateKB} KB</span>
          </p>
          {summary.lastExtractedAt && (
            <p>
              <span className="text-muted-foreground">Última extração:</span>{" "}
              <span className="font-medium text-xs">
                {new Date(summary.lastExtractedAt).toLocaleString("pt-BR")}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <WorkspaceLayout header={header} sidebar={sidebar}>
      <div className="p-4">
        <Tabs defaultValue="geometries" className="w-full">
          <TabsList className="flex w-full overflow-x-auto whitespace-nowrap scrollbar-none pb-px h-auto">
            <TabsTrigger value="geometries" className="shrink-0 text-xs">
              📐 Geometrias
            </TabsTrigger>
            <TabsTrigger value="compressors" className="shrink-0 text-xs">
              ⚙️ Compressores
            </TabsTrigger>
            <TabsTrigger value="summary" className="shrink-0 text-xs">
              📊 Resumo
            </TabsTrigger>
          </TabsList>

          {/* ── Aba Geometrias ─────────────────────────────────────────────── */}
          <TabsContent value="geometries" className="mt-3">
            {geometries.length === 0 ? (
              <EmptyState message="Nenhum componente salvo. Use os workspaces para extrair dados." />
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Fonte
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        H×L×P (mm)
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Passo Aleta
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Ø Tubo
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Fileiras
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        FatCorAl
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {geometries.map((g) => (
                      <tr key={g.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {g.source}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {g.height_mm}×{g.width_mm}×{g.depth_mm}
                        </td>
                        <td className="px-3 py-2">{fmt(g.finPitch_mm)} mm</td>
                        <td className="px-3 py-2">{fmt(g.tubeDiameter_mm)} mm</td>
                        <td className="px-3 py-2">{g.tubeRows}</td>
                        <td className="px-3 py-2">{g.fatCorAl ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => handleUseGeometry(g.id)}
                            >
                              Usar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                removeGeometry(g.id);
                                toast.success("Geometria removida.");
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── Aba Compressores ───────────────────────────────────────────── */}
          <TabsContent value="compressors" className="mt-3">
            {compressors.length === 0 ? (
              <EmptyState message="Nenhum componente salvo. Use os workspaces para extrair dados." />
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Fonte
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Modelo
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Fluido
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Norma
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                        Coef[0]
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {compressors.map((c) => (
                      <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {c.source}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-medium">{c.model}</td>
                        <td className="px-3 py-2">{c.refrigerant}</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {c.norm}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{fmt(c.coefficients[0], 4)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => handleUseCompressor(c.id)}
                            >
                              Usar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                removeCompressor(c.id);
                                toast.success("Compressor removido.");
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── Aba Resumo ─────────────────────────────────────────────────── */}
          <TabsContent value="summary" className="mt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{summary.geometryCount}</p>
                      <p className="text-xs text-muted-foreground">Geometrias salvas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{summary.compressorCount}</p>
                      <p className="text-xs text-muted-foreground">Compressores salvos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div>
                    <p className="text-2xl font-bold">~{storageEstimateKB} KB</p>
                    <p className="text-xs text-muted-foreground">Armazenamento estimado</p>
                    {summary.lastExtractedAt && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Última extração:{" "}
                        {new Date(summary.lastExtractedAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </WorkspaceLayout>
  );
}
