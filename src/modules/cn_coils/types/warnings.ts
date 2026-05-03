export interface StructuredWarning {
  code: string;
  message: string | null;
  severity: "warning" | "error";
}
