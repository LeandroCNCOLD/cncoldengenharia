# PROMPT LOVABLE: Etapa 6 — Sistemas Completos (Mundo 2)

**Contexto:** Até agora, o simulador CN Coils dimensionou componentes isolados (Evaporador, Condensador, etc.) — chamamos isso de "Mundo 1". Agora precisamos implementar o "Mundo 2": a integração desses componentes em **Sistemas Completos**, onde a saída de um componente alimenta a entrada do outro automaticamente, e todos são enviados juntos para a montagem.

**Ação esperada:** Atualizar o Dashboard para incluir as rotas de Sistemas, criar a arquitetura de "Workspaces Slim" (formulários compactos) para permitir múltiplos componentes na mesma tela, implementar a lógica de encadeamento termodinâmico (cascata) e atualizar o envio em lote para o `useComponentStore`.

---

## 1. Regras Críticas (NÃO NEGOCIÁVEIS)

1. **NÃO altere nem refatore os componentes de UI do "Mundo 1"** (`AirSidePanel`, `FluidSidePanel`, `useCnCoilsStore`). Eles devem permanecer intactos.
2. **Abordagem Workspaces Slim:** Para a tela de sistemas, você **NÃO** deve tentar reusar os painéis pesados do Mundo 1 via context/providers. Em vez disso, crie formulários compactos específicos para a tela de sistemas (apenas inputs essenciais: Vazão, Temp, UR, Geometria).
3. **NÃO altere `src/modules/coldpro_v2/`**.
4. Ao enviar para montagem, **todos os componentes do sistema devem ser enviados de uma só vez** e a tela deve navegar para `/coldpro/assembly`.

---

## 2. Atualização do Dashboard (`CnCoilsDashboardPage.tsx`)

O Dashboard deve ser dividido visualmente em dois grupos claros (pode usar abas ou seções com títulos):

### GRUPO A: Componentes Isolados (Mundo 1)
Manter os 8 cards atuais (Evaporador, Condensador, etc.).

### GRUPO B: Sistemas Completos (Mundo 2)
Adicionar 4 novos cards com rotas próprias:
1. **Desumidificação** (Evaporador + Reaquecimento) → `/coldpro/unilab/systems/dehumidification`
   Arquivo de rota: `src/routes/_app/coldpro.unilab.systems.dehumidification.tsx`
2. **Sistema DX Completo** (Evaporador + Condensador) → `/coldpro/unilab/systems/dx-complete`
   Arquivo de rota: `src/routes/_app/coldpro.unilab.systems.dx-complete.tsx`
3. **Câmara Fria** (Evaporador + Condensador + Carga Térmica) → `/coldpro/unilab/systems/cold-room`
   Arquivo de rota: `src/routes/_app/coldpro.unilab.systems.cold-room.tsx`
4. **Bomba de Calor** (Unidade Interna + Externa) → `/coldpro/unilab/systems/heat-pump`
   Arquivo de rota: `src/routes/_app/coldpro.unilab.systems.heat-pump.tsx`

---

## 3. Implementação do Sistema de Desumidificação

Crie a página `src/modules/unilab_simulator/pages/systems/DehumidificationSystemPage.tsx`.

O arquivo de rota correspondente é `src/routes/_app/coldpro.unilab.systems.dehumidification.tsx` e deve importar e renderizar esse componente.

### 3.1. Layout da Tela (Workspaces Slim)
A tela deve exibir **DOIS** formulários compactos (slim) lado a lado:
- **Lado Esquerdo:** Evaporador DX (Resfriamento e Desumidificação)
- **Lado Direito:** Bateria de Aquecimento (Reaquecimento Sensível)

*O que é um Workspace Slim?*
É um componente React local (`SystemEvaporatorForm` e `SystemHeatingForm`) que tem seu próprio estado React (`useState`) contendo apenas:
- Inputs Termodinâmicos Essenciais: Vazão de Ar, Temp. Entrada DB, UR Entrada.
- Seleção de Geometria (Dropdown simplificado listando geometrias do catálogo).

### 3.2. Lógica de Encadeamento (Cascata Termodinâmica)
- O usuário preenche as condições do ar de entrada **APENAS** no Evaporador (lado esquerdo).
- O Lado Ar da Bateria de Aquecimento (lado direito) fica **bloqueado/read-only** para as entradas.
- Ao clicar no botão global "Calcular Sistema":
  1. A página chama o motor de cálculo (`useCnCoilsSimulation.run()` ou equivalente manual usando os inputs locais do Evaporador).
  2. O resultado gera `airOutletTempC` e `airOutletRhPercent`.
  3. Esses valores são **injetados automaticamente** no estado local da Bateria de Aquecimento.
  4. A página chama o motor de cálculo para a Bateria de Aquecimento usando esses novos inputs.

### 3.3. Painel de Resultados do Sistema
No rodapé ou no topo da tela, adicione um painel de resumo unificado mostrando:
- **Capacidade de Resfriamento:** `evapResult.totalCapacityKw` kW
- **Água Condensada:** `evapResult.latentCapacityKw` (convertido para kg/h de água extraída)
- **Capacidade de Reaquecimento:** `heatingResult.totalCapacityKw` kW
- **Ar Tratado Final:** `heatingResult.airOutletTempC` °C a `heatingResult.airOutletRhPercent` % UR.

---

## 4. Envio em Lote para a Montagem

O botão **"Enviar Sistema para Montagem"** deve gerar os *specs* de **ambos os componentes** e adicioná-los ao `useComponentStore` em uma única transação.

### 4.1. Adapter da Bateria de Reaquecimento

O ColdPro V2 já possui o `reheatCoilCatalogAdapter`. Crie o adapter `toReheatCoilInput` reutilizando-o:

```typescript
// src/modules/unilab_simulator/adapters/toReheatCoilInput.ts
import { reheatCoilCatalogAdapter } from '@/modules/coldpro_v2/adapters/reheatCoilCatalogAdapter';
import type { CnCoilsPhysicalInputs, CnCoilsThermoInputs, CnCoilsSimulationResult } from '../types/unilab.types';

export function toReheatCoilInput(
  physical: CnCoilsPhysicalInputs,
  thermo: CnCoilsThermoInputs,
  result: CnCoilsSimulationResult,
  ctx: { tubeMaterials: any[] }
) {
  return reheatCoilCatalogAdapter({
    finnedLengthMm: physical.finnedLengthMm,
    finnedHeightMm: physical.finnedHeightMm,
    rows: physical.rows,
    circuits: physical.circuits,
    tubeOuterDiameterMm: physical.tubeOuterDiameterMm,
    tubeInnerDiameterMm: physical.tubeInnerDiameterMm,
    finPitchMm: physical.finPitchMm,
    finThicknessMm: physical.finThicknessMm,
    airFlowM3H: thermo.airFlowM3H,
    airInletTempC: thermo.airInletTempC,
    airOutletTempC: result.airOutletTempC,
    totalCapacityKw: result.totalCapacityKw,
    tubeMaterials: ctx.tubeMaterials,
  });
}
```

### 4.2. Envio em Lote

```typescript
import { useComponentStore } from '@/modules/coldpro_v2/store/useComponentStore';
import { useNavigate } from '@tanstack/react-router';
import { toEvaporatorInput } from '../adapters/toEvaporatorInput';
import { toReheatCoilInput } from '../adapters/toReheatCoilInput';

// Dentro do handleSendToAssembly:
const store = useComponentStore.getState();
const baseName = `Desumidificador ${new Date().toLocaleString('pt-BR')}`;

// 1. Gera e envia o spec do Evaporador
const evapSpec = toEvaporatorInput(evapPhysical, evapThermo, evapResult, ctx);
store.addCoil(`${baseName} - Evap`, "evaporator", evapSpec);

// 2. Gera e envia o spec da Bateria de Reaquecimento
// Usa o reheatCoilCatalogAdapter existente no ColdPro V2 via toReheatCoilInput
const reheatSpec = toReheatCoilInput(heatPhysical, heatThermo, heatResult, ctx);
store.addCoil(`${baseName} - Reaquecimento`, "heating", reheatSpec);

// 3. Navega para a montagem do ColdPro V2
navigate({ to: "/coldpro/assembly" }); // Rota do ColdPro V2 — NÃO alterar
```

---

## 5. Auditoria e Tipagem

Após implementar a tela de Desumidificação:
1. Crie arquivos placeholder (telas vazias com mensagem "Em breve") para os outros 3 sistemas:
   - `src/routes/_app/coldpro.unilab.systems.dx-complete.tsx`
   - `src/routes/_app/coldpro.unilab.systems.cold-room.tsx`
   - `src/routes/_app/coldpro.unilab.systems.heat-pump.tsx`
   Cada um deve exportar um componente React mínimo com a mensagem "Em breve" para que as rotas não quebrem.
2. Execute obrigatoriamente:
   `npx tsc --noEmit`
3. Garanta que o Mundo 1 continua funcionando perfeitamente, sem nenhuma alteração nos painéis originais.
