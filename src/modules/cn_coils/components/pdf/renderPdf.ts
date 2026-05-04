import { pdf } from "@react-pdf/renderer";
import type React from "react";

export async function renderPdfBlob(document: React.ReactElement): Promise<Blob> {
  return pdf(document as Parameters<typeof pdf>[0]).toBlob();
}
