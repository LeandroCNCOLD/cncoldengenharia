/**
 * Feature J — WorkspacePdfReport completo A4 (4 páginas)
 *
 * Página 1: Capa com título, tipo de componente, data e informações do projeto
 * Página 2: Parâmetros de entrada (inputs)
 * Página 3: Resultados da simulação
 * Página 4: Envelope de operação + avisos + notas técnicas
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface WorkspacePdfReportProps {
  componentType:
    | "evaporator"
    | "condenser_air"
    | "compressor"
    | "evaporative_condenser"
    | "water_condenser"
    | "heating_coil";
  title: string;
  projectName?: string;
  engineerName?: string;
  inputs: Record<string, string | number>;
  results: Record<string, string | number>;
  envelopePoints?: Array<Record<string, string | number>>;
  warnings?: string[];
  notes?: string[];
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const C = {
  primary: "#0055a4",
  primaryLight: "#e8f0fb",
  text: "#1a1a1a",
  muted: "#666",
  border: "#d1d5db",
  altRow: "#f9fafb",
  warning: "#fff8e1",
  warningBorder: "#f59e0b",
  warningText: "#92400e",
  white: "#ffffff",
};

const s = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────────
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.text,
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },
  // ── Capa ────────────────────────────────────────────────────────────────────
  coverBand: {
    backgroundColor: C.primary,
    paddingHorizontal: 40,
    paddingTop: 60,
    paddingBottom: 40,
  },
  coverLogo: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 40,
  },
  logoCn: { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.white },
  logoCold: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#cce0ff" },
  logoEng: { fontSize: 10, color: "#99c2ff", marginLeft: 4 },
  coverTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  coverSubtitle: { fontSize: 13, color: "#cce0ff", marginBottom: 4 },
  coverMeta: { fontSize: 9, color: "#99c2ff" },
  coverBody: { paddingHorizontal: 40, paddingTop: 30, paddingBottom: 20 },
  coverInfoRow: { flexDirection: "row", marginBottom: 8 },
  coverInfoLabel: { width: 120, fontSize: 9, color: C.muted },
  coverInfoValue: { flex: 1, fontSize: 9, fontFamily: "Helvetica-Bold" },
  coverDivider: { borderBottomWidth: 1, borderBottomColor: C.border, marginVertical: 16 },
  coverNote: { fontSize: 8, color: C.muted, fontStyle: "italic" },
  // ── Páginas internas ────────────────────────────────────────────────────────
  innerHeader: {
    backgroundColor: C.primary,
    paddingHorizontal: 40,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  innerHeaderLogo: { flexDirection: "row", alignItems: "baseline" },
  innerHeaderLogoCn: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.white },
  innerHeaderLogoCold: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#cce0ff" },
  innerHeaderTitle: { fontSize: 9, color: "#cce0ff" },
  innerBody: { paddingHorizontal: 40, paddingTop: 20 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    backgroundColor: C.primaryLight,
    color: C.primary,
    padding: "5 8",
    marginBottom: 0,
    marginTop: 12,
  },
  // ── Tabela ──────────────────────────────────────────────────────────────────
  table: { width: "100%", marginBottom: 12 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.primary,
    padding: "4 6",
  },
  tableHeaderCell: { flex: 1, fontSize: 8, color: C.white, fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableRowAlt: { backgroundColor: C.altRow },
  tableCell: { flex: 1, padding: "3 6", fontSize: 8.5 },
  tableCellRight: { flex: 1, padding: "3 6", fontSize: 8.5, textAlign: "right", fontFamily: "Helvetica-Bold" },
  // ── Avisos ──────────────────────────────────────────────────────────────────
  warningBox: {
    backgroundColor: C.warning,
    borderWidth: 1,
    borderColor: C.warningBorder,
    padding: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  warningTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4, color: C.warningText },
  warningItem: { fontSize: 8.5, color: C.warningText, marginBottom: 2 },
  // ── Notas ───────────────────────────────────────────────────────────────────
  noteBox: {
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    padding: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  noteTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4, color: "#0369a1" },
  noteItem: { fontSize: 8.5, color: "#0369a1", marginBottom: 2 },
  // ── Rodapé ──────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 16,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 4,
  },
  footerText: { fontSize: 7, color: C.muted },
});

// ── Utilitários ───────────────────────────────────────────────────────────────

const COMPONENT_LABELS: Record<WorkspacePdfReportProps["componentType"], string> = {
  evaporator: "Evaporador DX",
  condenser_air: "Condensador a Ar",
  compressor: "Compressor",
  evaporative_condenser: "Condensador Evaporativo",
  water_condenser: "Condensador a Água",
  heating_coil: "Bateria de Aquecimento",
};

function fmt(v: string | number): string {
  if (typeof v === "number") {
    return v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  }
  return String(v);
}

function recordToRows(record: Record<string, string | number>) {
  return Object.entries(record).map(([k, v]) => ({ label: k, value: fmt(v) }));
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function InnerHeader({ title, date }: { title: string; date: string }) {
  return (
    <View style={s.innerHeader} fixed>
      <View style={s.innerHeaderLogo}>
        <Text style={s.innerHeaderLogoCn}>CN</Text>
        <Text style={s.innerHeaderLogoCold}>Cold</Text>
      </View>
      <Text style={s.innerHeaderTitle}>{title}</Text>
      <Text style={s.innerHeaderTitle}>{date}</Text>
    </View>
  );
}

function Footer({ page, total }: { page: number; total: number }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>CNCold Engenharia © 2026 — Documento confidencial</Text>
      <Text style={s.footerText}>
        Página {page} de {total}
      </Text>
    </View>
  );
}

function SectionTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <View>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.table}>
        {rows.map((row, i) => (
          <View
            key={`${title}-${row.label}-${i}`}
            style={[s.tableRow, ...(i % 2 === 1 ? [s.tableRowAlt] : [])]}
          >
            <Text style={s.tableCell}>{row.label}</Text>
            <Text style={s.tableCellRight}>{row.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Documento principal ───────────────────────────────────────────────────────

export function WorkspacePdfReport({
  componentType,
  title,
  projectName,
  engineerName,
  inputs,
  results,
  envelopePoints = [],
  warnings = [],
  notes = [],
}: WorkspacePdfReportProps) {
  const date = new Date().toLocaleString("pt-BR");
  const compLabel = COMPONENT_LABELS[componentType] ?? componentType;
  const inputRows = recordToRows(inputs);
  const resultRows = recordToRows(results);
  const TOTAL_PAGES = 4;

  // Envelope: até 20 pontos na página 4
  const envRows = envelopePoints.slice(0, 20);
  const envCols = envRows.length > 0 ? Object.keys(envRows[0]) : [];

  return (
    <Document>
      {/* ── PÁGINA 1: CAPA ──────────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        {/* Faixa azul superior */}
        <View style={s.coverBand}>
          <View style={s.coverLogo}>
            <Text style={s.logoCn}>CN</Text>
            <Text style={s.logoCold}>Cold</Text>
            <Text style={s.logoEng}>Engenharia</Text>
          </View>
          <Text style={s.coverTitle}>{title}</Text>
          <Text style={s.coverSubtitle}>{compLabel}</Text>
          <Text style={s.coverMeta}>Gerado em: {date}</Text>
        </View>

        {/* Corpo da capa */}
        <View style={s.coverBody}>
          {projectName && (
            <View style={s.coverInfoRow}>
              <Text style={s.coverInfoLabel}>Projeto:</Text>
              <Text style={s.coverInfoValue}>{projectName}</Text>
            </View>
          )}
          {engineerName && (
            <View style={s.coverInfoRow}>
              <Text style={s.coverInfoLabel}>Engenheiro:</Text>
              <Text style={s.coverInfoValue}>{engineerName}</Text>
            </View>
          )}
          <View style={s.coverInfoRow}>
            <Text style={s.coverInfoLabel}>Componente:</Text>
            <Text style={s.coverInfoValue}>{compLabel}</Text>
          </View>
          <View style={s.coverInfoRow}>
            <Text style={s.coverInfoLabel}>Parâmetros de entrada:</Text>
            <Text style={s.coverInfoValue}>{inputRows.length} campos</Text>
          </View>
          <View style={s.coverInfoRow}>
            <Text style={s.coverInfoLabel}>Resultados:</Text>
            <Text style={s.coverInfoValue}>{resultRows.length} campos</Text>
          </View>
          {envelopePoints.length > 0 && (
            <View style={s.coverInfoRow}>
              <Text style={s.coverInfoLabel}>Pontos de envelope:</Text>
              <Text style={s.coverInfoValue}>{envelopePoints.length}</Text>
            </View>
          )}
          <View style={s.coverDivider} />
          <Text style={s.coverNote}>
            Este relatório foi gerado automaticamente pelo sistema CNCold Engenharia.
            Os resultados apresentados são baseados nos modelos termodinâmicos implementados
            e devem ser validados por um engenheiro responsável antes de uso em projetos.
          </Text>
        </View>
        <Footer page={1} total={TOTAL_PAGES} />
      </Page>

      {/* ── PÁGINA 2: PARÂMETROS DE ENTRADA ─────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <InnerHeader title={`${title} — Parâmetros de Entrada`} date={date} />
        <View style={s.innerBody}>
          <SectionTable title="Parâmetros de Entrada" rows={inputRows} />
        </View>
        <Footer page={2} total={TOTAL_PAGES} />
      </Page>

      {/* ── PÁGINA 3: RESULTADOS ─────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <InnerHeader title={`${title} — Resultados`} date={date} />
        <View style={s.innerBody}>
          <SectionTable title="Resultados da Simulação" rows={resultRows} />
        </View>
        <Footer page={3} total={TOTAL_PAGES} />
      </Page>

      {/* ── PÁGINA 4: ENVELOPE + AVISOS + NOTAS ─────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <InnerHeader title={`${title} — Envelope e Observações`} date={date} />
        <View style={s.innerBody}>
          {/* Envelope de operação */}
          {envRows.length > 0 ? (
            <View>
              <Text style={s.sectionTitle}>Envelope de Operação (primeiros {envRows.length} pontos)</Text>
              <View style={s.table}>
                {/* Cabeçalho */}
                <View style={s.tableHeader}>
                  {envCols.map((col) => (
                    <Text key={col} style={s.tableHeaderCell}>
                      {col}
                    </Text>
                  ))}
                </View>
                {/* Linhas */}
                {envRows.map((row, i) => (
                  <View
                    key={i}
                    style={[s.tableRow, ...(i % 2 === 1 ? [s.tableRowAlt] : [])]}
                  >
                    {envCols.map((col) => (
                      <Text key={col} style={s.tableCell}>
                        {fmt(row[col] ?? "")}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View>
              <Text style={s.sectionTitle}>Envelope de Operação</Text>
              <Text style={{ ...s.coverNote, padding: 8 }}>
                Nenhum dado de envelope disponível para este componente.
              </Text>
            </View>
          )}

          {/* Avisos */}
          {warnings.length > 0 && (
            <View style={s.warningBox}>
              <Text style={s.warningTitle}>⚠ AVISOS</Text>
              {warnings.map((w, i) => (
                <Text key={i} style={s.warningItem}>
                  • {w}
                </Text>
              ))}
            </View>
          )}

          {/* Notas técnicas */}
          {notes.length > 0 && (
            <View style={s.noteBox}>
              <Text style={s.noteTitle}>ℹ Notas Técnicas</Text>
              {notes.map((n, i) => (
                <Text key={i} style={s.noteItem}>
                  {i + 1}. {n}
                </Text>
              ))}
            </View>
          )}

          {/* Nota padrão se não houver avisos nem notas */}
          {warnings.length === 0 && notes.length === 0 && (
            <View style={s.noteBox}>
              <Text style={s.noteTitle}>ℹ Notas Técnicas</Text>
              <Text style={s.noteItem}>
                1. Os cálculos utilizam correlações de transferência de calor validadas para
                refrigeração industrial.
              </Text>
              <Text style={s.noteItem}>
                2. Verifique as condições de operação antes de dimensionar o sistema completo.
              </Text>
              <Text style={s.noteItem}>
                3. Consulte o engenheiro responsável para validação dos resultados.
              </Text>
            </View>
          )}
        </View>
        <Footer page={4} total={TOTAL_PAGES} />
      </Page>
    </Document>
  );
}
