// Classificador de arquivos: usa extensão, mime, nome e (opcional) conteúdo.

import type {
  Classification,
  FileMetadata,
  FileType,
  TechnicalDocumentType,
} from "./ingestionTypes";

function detectFileType(meta: FileMetadata): FileType {
  const ext = meta.extension.toLowerCase();
  const mime = (meta.mimeType ?? "").toLowerCase();
  if (ext === "pdf" || mime.includes("pdf")) return "pdf";
  if (["xls", "xlsx", "xlsm", "ods"].includes(ext) || mime.includes("spreadsheet")) return "spreadsheet";
  if (ext === "csv" || mime.includes("csv")) return "csv";
  if (["doc", "docx", "rtf", "odt"].includes(ext) || mime.includes("word")) return "doc";
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff"].includes(ext) || mime.startsWith("image/"))
    return "image";
  return "unknown";
}

const NAME_RULES: { match: RegExp; type: TechnicalDocumentType; reason: string; weight: number }[] = [
  { match: /\b(evap|evaporador|evaporator)\b/i, type: "evaporator", reason: "nome contém evaporador", weight: 0.4 },
  { match: /\b(cond|condensador|condenser)\b/i, type: "condenser", reason: "nome contém condensador", weight: 0.4 },
  { match: /\b(compressor|copeland|bitzer|danfoss)\b/i, type: "compressor", reason: "nome contém compressor", weight: 0.5 },
  { match: /\b(laudo|teste|test[-_ ]?report)\b/i, type: "test_report", reason: "nome sugere laudo de teste", weight: 0.4 },
  { match: /\b(curva|curve|coefficients?)\b/i, type: "curve", reason: "nome sugere curva", weight: 0.4 },
  { match: /\bcatalog/i, type: "catalog", reason: "nome sugere catálogo", weight: 0.3 },
];

const CONTENT_RULES: { match: RegExp; type: TechnicalDocumentType; reason: string; weight: number }[] = [
  {
    match: /(temperatura de evapora|superaqueciment|evaporation temperature|suction superheat)/i,
    type: "evaporator",
    reason: "conteúdo menciona evaporação/superaquecimento",
    weight: 0.5,
  },
  {
    match: /(temperatura de condensa|subresfriamento|condensing temperature|sub-?cooling)/i,
    type: "condenser",
    reason: "conteúdo menciona condensação/subresfriamento",
    weight: 0.5,
  },
  {
    match: /(AHRI[\s-]?540|polynomial|capacity coefficients|coeficientes de capacidade)/i,
    type: "compressor",
    reason: "conteúdo menciona AHRI/polinômio",
    weight: 0.6,
  },
  {
    match: /Unilab Coils[\s\S]{0,200}bateria de expans[aã]o direta/i,
    type: "evaporator",
    reason: "Unilab Coils + bateria de expansão direta",
    weight: 0.7,
  },
  {
    match: /Unilab Coils[\s\S]{0,200}bateria de condensa[cç][aã]o/i,
    type: "condenser",
    reason: "Unilab Coils + bateria de condensação",
    weight: 0.7,
  },
];

export function classifyFile(meta: FileMetadata, rawText?: string | null): Classification {
  const fileType = detectFileType(meta);
  const reasons: string[] = [];
  const scores = new Map<TechnicalDocumentType, number>();

  const addScore = (t: TechnicalDocumentType, w: number, reason: string) => {
    scores.set(t, (scores.get(t) ?? 0) + w);
    reasons.push(reason);
  };

  for (const r of NAME_RULES) {
    if (r.match.test(meta.filename)) addScore(r.type, r.weight, r.reason);
  }
  if (rawText) {
    for (const r of CONTENT_RULES) {
      if (r.match.test(rawText)) addScore(r.type, r.weight, r.reason);
    }
  }

  let best: TechnicalDocumentType = "generic";
  let bestScore = 0;
  for (const [t, s] of scores) {
    if (s > bestScore) {
      best = t;
      bestScore = s;
    }
  }
  const confidence = Math.min(1, bestScore);

  if (confidence === 0) reasons.push("Nenhuma regra correspondeu — classificado como genérico.");

  return {
    fileType,
    technicalDocumentType: best,
    confidence,
    reasons,
  };
}
