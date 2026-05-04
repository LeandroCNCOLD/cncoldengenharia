import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

export interface PdfReportSection {
  title: string;
  rows: Array<{ label: string; value: string; unit?: string }>;
}

interface PdfReportDocumentProps {
  title: string;
  subtitle?: string;
  date: string;
  sections: PdfReportSection[];
  warnings?: string[];
  logoUrl?: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  logo: { width: 80, height: 30 },
  companyName: { fontSize: 14, fontWeight: "bold", color: "#0066cc" },
  logoTextRow: { flexDirection: "row", alignItems: "baseline" },
  logoCn: { fontSize: 18, fontWeight: "bold", color: "#0066cc" },
  logoCold: { fontSize: 18, fontWeight: "bold", color: "#1a1a1a" },
  logoEng: { fontSize: 10, color: "#666", marginLeft: 4 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4, textTransform: "uppercase" },
  subtitle: { fontSize: 11, color: "#666", marginBottom: 16 },
  date: { fontSize: 9, color: "#999", marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", backgroundColor: "#f0f4f8", padding: 6, marginBottom: 0 },
  table: { width: "100%", marginBottom: 16 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  tableRowAlt: { backgroundColor: "#f9fafb" },
  tableCell: { flex: 1, padding: "4 6" },
  tableCellRight: { flex: 1, padding: "4 6", textAlign: "right" },
  warningBox: { backgroundColor: "#fff8e1", border: "1 solid #f59e0b", padding: 8, marginBottom: 8 },
  warningTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 4, color: "#92400e" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#999" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginVertical: 12 },
});

function Logo({ logoUrl }: { logoUrl?: string }) {
  if (logoUrl) return <Image src={logoUrl} style={styles.logo} />;
  return (
    <View style={styles.logoTextRow}>
      <Text style={styles.logoCn}>CN</Text>
      <Text style={styles.logoCold}>Cold</Text>
      <Text style={styles.logoEng}>Engenharia</Text>
    </View>
  );
}

export function PdfReportDocument({
  title,
  subtitle,
  date,
  sections,
  warnings = [],
  logoUrl,
}: PdfReportDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Logo logoUrl={logoUrl} />
          <Text style={styles.companyName}>CNCold Engenharia</Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <Text style={styles.date}>Gerado em: {date}</Text>

        {sections.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.table}>
              {section.rows.map((row, index) => (
                <View
                  key={`${section.title}-${row.label}`}
                  style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]}
                >
                  <Text style={styles.tableCell}>{row.label}</Text>
                  <Text style={styles.tableCellRight}>
                    {row.value}
                    {row.unit ? ` ${row.unit}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {warnings.length > 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>AVISOS</Text>
            {warnings.map((warning) => (
              <Text key={warning}>• {warning}</Text>
            ))}
          </View>
        )}

        <Text style={styles.footer}>CNCold Engenharia © 2026</Text>
      </Page>
    </Document>
  );
}
