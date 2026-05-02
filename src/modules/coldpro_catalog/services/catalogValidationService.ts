import type { CatalogEquipmentRow, CatalogValidationIssue } from "../data/equipmentCatalog.types";

export function validateCatalogRow(row: CatalogEquipmentRow): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];

  if (!row.id)
    issues.push({
      equipmentId: row.id,
      field: "id",
      severity: "error",
      message: "ID obrigatório não informado.",
    });
  if (!row.modelo)
    issues.push({
      equipmentId: row.id,
      field: "modelo",
      severity: "error",
      message: "Modelo obrigatório não informado.",
    });
  if (!row.refrigerante || row.refrigerante === "unknown") {
    issues.push({
      equipmentId: row.id,
      field: "refrigerante",
      severity: "warning",
      message: "Refrigerante não identificado.",
    });
  }
  if (!row.capacidadeFrigorificaKcalH && !row.capacidadeCompressorKcalH) {
    issues.push({
      equipmentId: row.id,
      field: "capacidadeFrigorificaKcalH",
      severity: "warning",
      message: "Equipamento sem capacidade frigorífica informada.",
    });
  }
  if (typeof row.potenciaEletricaKw === "number" && row.potenciaEletricaKw <= 0) {
    issues.push({
      equipmentId: row.id,
      field: "potenciaEletricaKw",
      severity: "error",
      message: "Potência elétrica deve ser maior que zero.",
    });
  }

  return issues;
}

export function validateCatalog(rows: CatalogEquipmentRow[]): CatalogValidationIssue[] {
  return rows.flatMap(validateCatalogRow);
}
