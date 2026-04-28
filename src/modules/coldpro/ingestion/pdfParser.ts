// PDF parser: usa pdfjs-dist para extrair texto bruto.

import { PARSER_VERSION, type ParserResult } from "./ingestionTypes";

export async function pdfParser(file: ArrayBuffer): Promise<ParserResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let rawText = "";
  try {
    // Import dinâmico para evitar carregar no SSR.
    const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (opts: unknown) => { promise: Promise<unknown> };
    };
    const doc = (await pdfjs.getDocument({
      data: new Uint8Array(file),
      useSystemFonts: true,
      disableWorker: true,
    }).promise) as {
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: { str?: string }[] }>;
      }>;
    };
    const parts: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const text = content.items.map((it) => it.str ?? "").join(" ");
      parts.push(text);
    }
    rawText = parts.join("\n").replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
    if (!rawText) warnings.push("PDF sem texto extraível (talvez seja escaneado).");
  } catch (e) {
    errors.push((e as Error).message);
  }

  return {
    status: errors.length ? "failed" : rawText ? "parsed" : "needs_review",
    parserUsed: "pdfParser",
    parserVersion: PARSER_VERSION,
    rawText,
    structuredData: null,
    extractedFields: {},
    confidence: rawText ? 0.7 : 0.2,
    warnings,
    errors,
  };
}
