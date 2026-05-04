/**
 * Feature D — Painel de Anexos de Projeto
 * Permite adicionar e remover arquivos vinculados a um projeto salvo.
 */

import { useRef } from "react";
import { toast } from "sonner";
import { Paperclip, Trash2, Upload } from "lucide-react";

import { useProjectStore } from "../store/useProjectStore";
import type { ProjectAttachment } from "../store/useProjectStore";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB

const ATTACHMENT_TYPE_LABELS: Record<ProjectAttachment["type"], string> = {
  datasheet: "Datasheet",
  photo: "Foto",
  report: "Relatório",
  other: "Outro",
};

const ATTACHMENT_TYPE_VARIANTS: Record<
  ProjectAttachment["type"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  datasheet: "default",
  photo: "secondary",
  report: "outline",
  other: "outline",
};

function detectType(filename: string): ProjectAttachment["type"] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf") || lower.endsWith(".xlsx") || lower.endsWith(".xls"))
    return "datasheet";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png"))
    return "photo";
  return "other";
}

interface ProjectAttachmentsPanelProps {
  projectId: string;
}

export function ProjectAttachmentsPanel({ projectId }: ProjectAttachmentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const addAttachment = useProjectStore((s) => s.addAttachment);
  const removeAttachment = useProjectStore((s) => s.removeAttachment);

  const attachments = project?.snapshot.attachments ?? [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`Arquivo muito grande: ${(file.size / 1024).toFixed(0)} KB. Máximo: 500 KB.`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      addAttachment(projectId, {
        name: file.name,
        type: detectType(file.name),
        dataUrl,
      });
      toast.success(`Anexo "${file.name}" adicionado.`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Paperclip className="h-4 w-4" />
          Anexos ({attachments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum anexo. Adicione arquivos abaixo.</p>
        ) : (
          <ul className="space-y-1">
            {attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center justify-between rounded-md border border-border px-2 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant={ATTACHMENT_TYPE_VARIANTS[att.type]}
                    className="shrink-0 text-[10px]"
                  >
                    {ATTACHMENT_TYPE_LABELS[att.type]}
                  </Badge>
                  <span className="truncate text-xs">{att.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <a
                    href={att.dataUrl}
                    download={att.name}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Baixar
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      removeAttachment(projectId, att.id);
                      toast.success("Anexo removido.");
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full gap-1.5 text-xs"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3 w-3" />
          Adicionar Arquivo (máx. 500 KB)
        </Button>
      </CardContent>
    </Card>
  );
}
