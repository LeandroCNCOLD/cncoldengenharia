import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { SavedProject } from "../../store/useProjectStore";
import { bottleneckLabel, fmtBR, getProjectMetrics, projectTypeLabels } from "../../utils/projectComparison";

interface ComparisonPdfReportProps {
  projects: SavedProject[];
  date: string;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 9, color: "#1f2937" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  logo: { flexDirection: "row", alignItems: "baseline" },
  logoCn: { fontSize: 18, fontWeight: "bold", color: "#0066cc" },
  logoCold: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  company: { fontSize: 12, fontWeight: "bold", color: "#0066cc" },
  title: { fontSize: 15, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#6b7280", marginBottom: 14 },
  table: { borderWidth: 1, borderColor: "#d1d5db" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  headerCell: { flex: 1, padding: 5, backgroundColor: "#eff6ff", fontWeight: "bold" },
  metricCell: { width: 120, padding: 5, backgroundColor: "#f9fafb", fontWeight: "bold" },
  cell: { flex: 1, padding: 5 },
  footer: { position: "absolute", bottom: 18, left: 28, right: 28, textAlign: "center", color: "#9ca3af", fontSize: 8 },
});

const rows = [
  ["Tipo", (p: SavedProject) => projectTypeLabels[p.type]],
  ["Carga térmica", (p: SavedProject) => `${fmtBR(getProjectMetrics(p).loadW, 0)} W`],
  ["Capacidade real", (p: SavedProject) => `${fmtBR(getProjectMetrics(p).qRealW, 0)} W`],
  ["Te equilíbrio", (p: SavedProject) => `${fmtBR(getProjectMetrics(p).teC, 1)} °C`],
  ["Tc equilíbrio", (p: SavedProject) => `${fmtBR(getProjectMetrics(p).tcC, 1)} °C`],
  ["COP real", (p: SavedProject) => fmtBR(getProjectMetrics(p).cop)],
  ["Potência compressor", (p: SavedProject) => `${fmtBR(getProjectMetrics(p).wCompW, 0)} W`],
  ["EER", (p: SavedProject) => `${fmtBR(getProjectMetrics(p).eer)} BTU/Wh`],
  ["Gargalo", (p: SavedProject) => bottleneckLabel(getProjectMetrics(p).bottleneck)],
] as const;

export function ComparisonPdfReport({ projects, date }: ComparisonPdfReportProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoCn}>CN</Text>
            <Text style={styles.logoCold}>Cold</Text>
          </View>
          <Text style={styles.company}>CNCold Engenharia</Text>
        </View>
        <Text style={styles.title}>Comparação de Sistemas</Text>
        <Text style={styles.subtitle}>Gerado em: {date}</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.metricCell}>Métrica</Text>
            {projects.map((project) => (
              <Text key={project.id} style={styles.headerCell}>{project.name}</Text>
            ))}
          </View>
          {rows.map(([label, render]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.metricCell}>{label}</Text>
              {projects.map((project) => (
                <Text key={`${project.id}-${label}`} style={styles.cell}>{render(project)}</Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={styles.footer}>CNCold Engenharia © 2026</Text>
      </Page>
    </Document>
  );
}
