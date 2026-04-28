import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Cog,
  Download,
  Eye,
  GitCompare,
  History,
  Loader2,
  Plus,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  FILE_GROUPS,
  FILE_STATUS_LABELS,
  TECHNICAL_CATEGORIES,
  TechnicalUploadError,
  approveTechnicalFile,
  getTechnicalFileSignedUrl,
  processTechnicalFile,
  setTechnicalFileStatus,
  slugify,
  uploadTechnicalFile,
  type FileGroup,
  type TechnicalCategory,
  type TechnicalFileStatus,
} from "@/lib/technical-uploads";

export const Route = createFileRoute("/_app/uploads")({
  component: UploadsPage,
});

const STATUS_VARIANT: Record<
  TechnicalFileStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  uploaded: "secondary",
  processing: "outline",
  parsed: "default",
  validated: "default",
  approved: "default",
  rejected: "destructive",
  archived: "outline",
};

function UploadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [productId, setProductId] = useState<string>("");
  const [fileGroup, setFileGroup] = useState<FileGroup | "">("");
  const [category, setCategory] = useState<TechnicalCategory | "">("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [openProduct, setOpenProduct] = useState(false);
  const [versionsForFile, setVersionsForFile] = useState<{
    productId: string;
    group: FileGroup;
    category: TechnicalCategory;
  } | null>(null);

  const products = useQuery({
    queryKey: ["technical-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technical_products")
        .select("id, name, slug, manufacturer")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const files = useQuery({
    queryKey: ["technical-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technical_files")
        .select(
          "id, product_id, file_group, technical_category, original_filename, version_label, status, uploaded_at, uploaded_by, storage_path, is_current_version, technical_products(name, slug)",
        )
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const versions = useQuery({
    queryKey: ["technical-file-history", versionsForFile],
    enabled: !!versionsForFile,
    queryFn: async () => {
      if (!versionsForFile) return [];
      const { data, error } = await supabase
        .from("technical_files")
        .select("id, version_label, version_number, status, uploaded_at, original_filename")
        .eq("product_id", versionsForFile.productId)
        .eq("file_group", versionsForFile.group)
        .eq("technical_category", versionsForFile.category)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!user || !file || !productId || !fileGroup || !category) {
        throw new TechnicalUploadError("Preencha todos os campos obrigatórios.");
      }
      return uploadTechnicalFile({
        productId,
        fileGroup: fileGroup as FileGroup,
        technicalCategory: category as TechnicalCategory,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        file,
        userId: user.id,
      });
    },
    onSuccess: (res) => {
      toast.success(`Arquivo enviado (${res.versionLabel}).`);
      setFile(null);
      setDescription("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["technical-files"] });
    },
    onError: (e) => toast.error("Falha no envio", { description: (e as Error).message }),
    onSettled: () => setBusy(false),
  });

  async function handleProcess(id: string) {
    if (!user) return;
    try {
      await processTechnicalFile(id, user.id);
      toast.success("Arquivo processado.");
      qc.invalidateQueries({ queryKey: ["technical-files"] });
      // Busca extração mais recente para exibir
      const { data: ext } = await supabase
        .from("technical_file_extractions")
        .select("*")
        .eq("file_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ext) setExtractionView({ fileId: id, extraction: ext });
    } catch (e) {
      toast.error("Falha ao processar", { description: (e as Error).message });
    }
  }

  async function handleApprove(id: string) {
    if (!user) return;
    try {
      await approveTechnicalFile(id, user.id);
      toast.success("Aprovado para o catálogo técnico.");
      qc.invalidateQueries({ queryKey: ["technical-files"] });
    } catch (e) {
      toast.error("Falha ao aprovar", { description: (e as Error).message });
    }
  }

  async function handleReject(id: string) {
    if (!user) return;
    await setTechnicalFileStatus(id, "rejected", user.id);
    toast.success("Arquivo rejeitado.");
    qc.invalidateQueries({ queryKey: ["technical-files"] });
  }

  async function handleView(path: string) {
    try {
      const url = await getTechnicalFileSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const canSubmit = useMemo(
    () => !!user && !!productId && !!fileGroup && !!category && !!file,
    [user, productId, fileGroup, category, file],
  );

  return (
    <div>
      <PageHeader
        title="Upload Técnico"
        description="Central técnica de documentos por produto, grupo, categoria e versão."
      />

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Enviar arquivo técnico</CardTitle>
          <NewProductDialog
            open={openProduct}
            onOpenChange={setOpenProduct}
            onCreated={(id) => {
              setProductId(id);
              qc.invalidateQueries({ queryKey: ["technical-products"] });
            }}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Produto técnico *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.manufacturer ? ` · ${p.manufacturer}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grupo *</Label>
              <Select value={fileGroup} onValueChange={(v) => setFileGroup(v as FileGroup)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o grupo" />
                </SelectTrigger>
                <SelectContent>
                  {FILE_GROUPS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria técnica *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TechnicalCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {TECHNICAL_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: ficha técnica oficial CN 1200 LT"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Observação da versão</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: revisão de outubro 2026"
                maxLength={200}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Arquivo *</Label>
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
          </div>

          <Button
            onClick={() => {
              setBusy(true);
              upload.mutate();
            }}
            disabled={!canSubmit || busy}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" /> Enviar nova versão
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arquivos técnicos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {files.isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : !files.data?.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum arquivo enviado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.data.map((f) => {
                  const product = f.technical_products as { name: string; slug: string } | null;
                  const groupLabel =
                    FILE_GROUPS.find((g) => g.value === f.file_group)?.label ?? f.file_group;
                  const categoryLabel =
                    TECHNICAL_CATEGORIES.find((c) => c.value === f.technical_category)?.label ??
                    f.technical_category;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{product?.name ?? "—"}</TableCell>
                      <TableCell>{groupLabel}</TableCell>
                      <TableCell>{categoryLabel}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {f.version_label}
                        {f.is_current_version && (
                          <Badge variant="outline" className="ml-2">
                            atual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[f.status as TechnicalFileStatus]}>
                          {FILE_STATUS_LABELS[f.status as TechnicalFileStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(f.uploaded_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleView(f.storage_path)}
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleView(f.storage_path)}
                            title="Baixar"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleProcess(f.id)}
                            title="Processar"
                          >
                            <Cog className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setVersionsForFile({
                                productId: f.product_id,
                                group: f.file_group as FileGroup,
                                category: f.technical_category as TechnicalCategory,
                              })
                            }
                            title="Comparar versões"
                          >
                            <GitCompare className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleApprove(f.id)}
                            title="Aprovar para catálogo"
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReject(f.id)}
                            title="Rejeitar"
                            className="text-destructive hover:text-destructive"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!versionsForFile}
        onOpenChange={(open) => !open && setVersionsForFile(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de versões
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {versions.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : !versions.data?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma versão encontrada.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Versão</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.data.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.version_label}</TableCell>
                      <TableCell>{v.original_filename}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[v.status as TechnicalFileStatus]}>
                          {FILE_STATUS_LABELS[v.status as TechnicalFileStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(v.uploaded_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewProductDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      const slug = slugify(name);
      const { data, error } = await supabase
        .from("technical_products")
        .insert({
          name: name.trim(),
          slug,
          manufacturer: manufacturer.trim() || null,
          description: description.trim() || null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("Falha ao criar produto.");
      toast.success("Produto técnico criado.");
      props.onCreated(data.id);
      props.onOpenChange(false);
      setName("");
      setManufacturer("");
      setDescription("");
    } catch (e) {
      toast.error("Falha ao criar produto", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" /> Novo produto técnico
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar produto técnico</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>Fabricante</Label>
            <Input
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!name.trim() || busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
