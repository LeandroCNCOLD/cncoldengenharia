/**
 * Feature A — ValidationBanner
 * Exibe erros e avisos de validação de inputs.
 * Quando há erros, aplica `pointer-events-none opacity-50` ao botão Calcular via CSS class.
 */

import type { ValidationResult } from "../hooks/useInputValidation";

interface ValidationBannerProps {
  result: ValidationResult;
}

export function ValidationBanner({ result }: ValidationBannerProps) {
  const { isValid, errors, warnings } = result;

  if (isValid && warnings.length === 0) return null;

  return (
    <div className="mb-3 space-y-2">
      {errors.length > 0 && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <p className="mb-1 font-semibold">Erros de validação:</p>
          <ul className="list-inside list-disc space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <p className="mb-1 font-semibold">Avisos:</p>
          <ul className="list-inside list-disc space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Retorna className para desabilitar o botão Calcular quando há erros.
 */
export function calcButtonClass(result: ValidationResult): string {
  return result.isValid ? "" : "pointer-events-none opacity-50";
}
