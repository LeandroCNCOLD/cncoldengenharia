import React from 'react';
import type { AppliedUnilabFactors } from '../../modules/coldpro/unilabData/types';

export function UnilabFactorInspector({ factors }: { factors?: AppliedUnilabFactors | null }) {
  if (!factors) {
    return <div className="rounded-lg border p-3 text-sm text-muted-foreground">Sem fatores Unilab aplicados.</div>;
  }

  const rows = [
    ['Fator capacidade efetivo', factors.effectiveCapacityFactor],
    ['Heat transfer', factors.heatTransferFactor],
    ['Superfície', factors.surfaceFactor],
    ['Segurança', factors.securityFactor],
    ['ΔP ar', factors.airPressureDropFactor],
    ['ΔP refrigerante', factors.refrigerantPressureDropFactor],
  ];

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 font-medium">Fatores Unilab aplicados</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {rows.map(([label, value]) => (
          <React.Fragment key={String(label)}>
            <div className="text-muted-foreground">{label}</div>
            <div className="font-mono">{Number(value).toFixed(4)}</div>
          </React.Fragment>
        ))}
      </div>
      {factors.warnings.length > 0 && (
        <div className="mt-2 text-xs text-amber-700">{factors.warnings.join(' ')}</div>
      )}
    </div>
  );
}
