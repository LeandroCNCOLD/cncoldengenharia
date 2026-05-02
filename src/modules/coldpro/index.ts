// ColdPro frontend module — entrypoint.
export * from "./types";
export * as engineService from "./services/coldproEngineService";
export * as catalogService from "./services/catalogService";
export * as aiAssistantService from "./services/aiAssistantService";
export * as formatting from "./utils/formatting";
export * as validation from "./utils/validation";

// Stores
export { useUserModeStore } from "./stores/useUserModeStore";
export { useSessionStore } from "./stores/useSessionStore";

// Hooks
export { useEquilibrium } from "./hooks/useEquilibrium";
export { usePerformanceCurve } from "./hooks/usePerformanceCurve";
export { useOperatingMap } from "./hooks/useOperatingMap";
export { useProductRecord } from "./hooks/useProductRecord";
export { useRegistry } from "./hooks/useRegistry";
export { useAIAssistant } from "./hooks/useAIAssistant";

// Layout
export { AppShell } from "./components/layout/AppShell";
export { Sidebar } from "./components/layout/Sidebar";
export { TopBar } from "./components/layout/TopBar";
export { PageContainer } from "./components/layout/PageContainer";

// UI
export { TechnicalField } from "./components/ui/TechnicalField";
export { StatusBadge, type Status } from "./components/ui/StatusBadge";
export { WarningBanner } from "./components/ui/WarningBanner";
export { LoadingSpinner } from "./components/ui/LoadingSpinner";
export { EngineResultCard } from "./components/ui/EngineResultCard";

// Mode
export { UserModeSwitcher } from "./components/mode/UserModeSwitcher";
export { ModeGate } from "./components/mode/ModeGate";

// AI
export { AIAssistantPanel } from "./components/ai/AIAssistantPanel";
export { AIAssistantButton } from "./components/ai/AIAssistantButton";
export { FieldHelpTooltip } from "./components/ai/FieldHelpTooltip";

// Pages
export { DashboardPage } from "./pages/DashboardPage";
export { PlaceholderPage } from "./pages/PlaceholderPage";
