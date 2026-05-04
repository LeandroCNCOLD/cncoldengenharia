// Feature E — CN Cold brand chart colors
export const CHART_COLORS_ARRAY = [
  '#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
];

// Alias para compatibilidade com Feature F (useEnvelopeExport)
export const CHART_COLORS = {
  primary: "#3b82f6",
  secondary: "#06b6d4",
  accent: "#f59e0b",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  tc35: "#3b82f6",
  tc40: "#10b981",
  tc45: "#f59e0b",
  tc50: "#f97316",
  tc55: "#ef4444",
  surface: "#f1f5f9",
  cnBlue700: "#0d5aa8",
  grid: "rgba(148, 163, 184, 0.2)",
  axis: "#94a3b8",
  tooltip: {
    background: "#1e293b",
    border: "#334155",
    text: "#f1f5f9",
  },
} as const;
