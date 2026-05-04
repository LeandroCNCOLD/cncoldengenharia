import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export interface SystemWizardStep {
  id: number;
  label: string;
  icon: ReactNode;
  component: ReactNode;
  isComplete: boolean;
}

interface SystemWizardProps {
  title: string;
  steps: SystemWizardStep[];
  onComplete?: () => void;
  isCompleting?: boolean;
}

export function SystemWizard({ title, steps, onComplete, isCompleting = false }: SystemWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = steps[currentIndex];

  const canGoTo = (index: number) =>
    index === 0 || steps.slice(0, index).every((step) => step.isComplete);

  const goNext = () => {
    if (currentIndex === steps.length - 1) {
      onComplete?.();
      return;
    }
    const nextIndex = currentIndex + 1;
    if (canGoTo(nextIndex)) setCurrentIndex(nextIndex);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {steps.map((step, index) => {
            const active = index === currentIndex;
            const enabled = canGoTo(index);
            return (
              <button
                key={step.id}
                type="button"
                disabled={!enabled}
                onClick={() => enabled && setCurrentIndex(index)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : step.isComplete
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-500"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span>{step.icon}</span>
                <span className="font-medium">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>{current.component}</div>

      <div className="flex justify-between border-t pt-4">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          disabled={currentIndex === 0}
        >
          ← Anterior
        </Button>
        <Button onClick={goNext} disabled={!current.isComplete || isCompleting}>
          {currentIndex === steps.length - 1
            ? isCompleting
              ? "⏳ Gerando PDF..."
              : "📄 Exportar PDF"
            : "Próximo →"}
        </Button>
      </div>
    </div>
  );
}
