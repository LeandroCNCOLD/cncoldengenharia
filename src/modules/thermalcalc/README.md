# thermalcalc

Motor matemático oficial da CN COLD para refrigeração industrial.

## Princípios

- **Funções puras** — sem React, sem Supabase, sem I/O.
- **Testável isoladamente** — cada arquivo pode ser importado em testes Node.
- **Única fonte de verdade** para qualquer cálculo de:
  geometria, área, volume, carga de fluido, capacidade térmica, coeficientes
  (h_air, h_ref, U), perda de carga e ciclo termodinâmico completo.

## Estrutura

```
src/modules/thermalcalc/
├── engines/
│   ├── coil/
│   │   ├── internals/        ← motor híbrido (privado)
│   │   ├── correlations/     ← correlações de ar e refrigerante
│   │   ├── unilab/           ← tipos + mapper Unilab (puro)
│   │   ├── physicalSimpleEngine.ts
│   │   ├── dxEvaporatorSimulator.ts
│   │   ├── dxCondenserSimulator.ts
│   │   ├── evaporatorCoilSimulator.ts
│   │   ├── condenserCoilSimulator.ts
│   │   ├── geometryDerived.ts
│   │   ├── heatExchangeArea.ts
│   │   ├── performanceMapGenerator.ts
│   │   └── ...
│   └── system/
│       ├── systemSimulator.ts
│       ├── vapcycSystemSimulator.ts
│       ├── compressorEngine.ts / vapcycCompressorEngine.ts
│       ├── evaporatorWrapper.ts / condenserWrapper.ts
│       └── expansionDeviceEngine.ts
├── types/
│   ├── coilSimulatorTypes.ts
│   ├── coilEngineTypes.ts
│   └── unilabFactorTypes.ts
└── index.ts                  ← fachada (Coil, System, Types)
```

## Como usar

**Aplicação (ColdPro UI / server functions)** — sempre via adapter:

```ts
import {
  simulateCoil,
  calculateGeometry,
  calculateRefrigerantCharge,
} from "@/modules/coldpro/adapters/thermalcalcAdapter";
```

**Imports diretos** (apenas dentro de outras peças puras / testes):

```ts
import { Coil, System } from "@/modules/thermalcalc";
import type { CoilSimulatorInput } from "@/modules/thermalcalc/types/coilSimulatorTypes";
import { simulateHybridCoil } from "@/modules/thermalcalc/engines/coil";
import { simulateSystem, simulateSystemVapcyc } from "@/modules/thermalcalc/engines/system";
```

## Para o Cursor

Para evoluir o motor matemático, edite **somente** arquivos sob
`src/modules/thermalcalc/`. Não toque em `src/modules/coldpro/coil/*`,
`src/modules/coldpro/system/*` ou nos componentes — eles são wrappers/shims
que apenas re-exportam para manter compatibilidade.

Mantenha **estáveis as assinaturas públicas**:

- `Coil.simulateHybridCoil(input)`
- `Coil.simulatePhysicalSimple(input)`
- `Coil.simulateDxEvaporator(input)` / `Coil.simulateDxCondenser(input)`
- `Coil.deriveCoilGeometry(geometry)`
- `Coil.calcHeatExchangeArea(...)`
- `System.simulateSystem(...)` / `System.simulateSystemVapcyc(...)`
- `System.runEvaporator/runCondenser/runCompressor/runExpansionDevice`
- E todas as funções expostas em `adapters/thermalcalcAdapter.ts`.

Para evoluir internals (correlações, novas estratégias) basta criar arquivos
novos em `engines/coil/` ou `engines/system/` e exportá-los pelos respectivos
`index.ts`.

## Testes

Como o módulo é puro, testes unitários podem rodar em Node sem mocks de
Supabase ou React. Sugestão de pasta: `tests/unit/thermalcalc/...` no futuro.
