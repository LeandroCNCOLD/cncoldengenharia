import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ALLOWED_KINDS_BY_TYPE,
  acceptAttrFor,
  uploadComponentFile,
  UploadValidationError,
} from "@/lib/uploads";
import { useAuth } from "@/lib/auth";
import type { ComponentType } from "@/lib/component-schema";

interface Props {
  componentId: string;
  componentType: ComponentType;
  onUploaded?: () => void;
  compact?: boolean;
}

export function FileUploader({ componentId, componentType, onUploaded, compact }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allowed = ALLOWED_KINDS_BY_TYPE[componentType];

  async function handleUpload() {
    if (!file || !user) return;
    setBusy(true);
    try {
      await uploadComponentFile({
        componentId,
        componentType,
        file,
        userId: user.id,
      });
      toast.success(`Arquivo enviado: ${file.name}`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded?.();
    } catch (e) {
      const msg =
        e instanceof UploadValidationError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Erro inesperado.";
      toast.error("Falha no envio", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3 rounded-md border bg-muted/30 p-4"}>
      {!compact && (
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Enviar arquivo técnico</Label>
          <span className="text-xs text-muted-foreground">
            Aceito: {allowed.map((k) => k.toUpperCase()).join(", ")}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          ref={inputRef}
          type="file"
          accept={acceptAttrFor(componentType)}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
          className="flex-1"
        />
        <Button onClick={handleUpload} disabled={!file || busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" /> Enviar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
