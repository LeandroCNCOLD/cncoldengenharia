/**
 * Feature G — Página de Projeto Compartilhado
 * Decodifica o token da URL e exibe o snapshot do projeto.
 */

import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Share2 } from "lucide-react";

import { decodeProject } from "../hooks/useShareableLink";
import { restoreProjectSnapshot } from "../store/useProjectStore";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SharedProjectPageProps {
  token: string;
}

export function SharedProjectPage({ token }: SharedProjectPageProps) {
  const { project, error } = useMemo(() => {
    try {
      return { project: decodeProject(token), error: null };
    } catch (e) {
      return { project: null, error: String(e) };
    }
  }, [token]);

  if (error || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Link Inválido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O link compartilhado está corrompido ou expirou.
            </p>
            {error && (
              <pre className="rounded bg-muted p-2 text-[10px] text-muted-foreground overflow-auto">
                {error}
              </pre>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/coldpro">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Ir para o Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    cold_room: "Câmara Fria",
    dx_complete: "DX Completo",
    heat_pump: "Bomba de Calor",
    component_workspace: "Workspace de Componente",
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Projeto Compartilhado</h1>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{project.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{typeLabels[project.type] ?? project.type}</Badge>
              <Badge variant="outline">
                Criado em {new Date(project.createdAt).toLocaleDateString("pt-BR")}
              </Badge>
            </div>

            {project.snapshot.compressorModel && (
              <p>
                <span className="text-muted-foreground">Compressor:</span>{" "}
                <span className="font-medium">{project.snapshot.compressorModel}</span>
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => {
                  restoreProjectSnapshot(project);
                  window.location.href = "/coldpro";
                }}
              >
                Abrir no CNCold
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/coldpro">
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                  Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground">
          Este link foi gerado pelo CNCold Engenharia. Os dados são armazenados localmente no seu
          navegador.
        </p>
      </div>
    </div>
  );
}
