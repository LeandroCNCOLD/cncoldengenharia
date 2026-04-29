## Iteração crítica: Verify + Calibração ponto-a-ponto Unilab

A fundação já está pronta (tabela `coil_calibrations`, motor `physical_simple` aplicando os 3 fatores internamente, função `calibrateAgainstReference`, botão "Calibrar c/ Unilab" no header do Coil Simulator). Esta iteração fecha as lacunas para cumprir 100% dos 11 pontos do briefing.

---

### 1. Schema — `coil_calibrations`

Adicionar 3 colunas (ALTER TABLE, sem destruir nada):

- `status` text NOT NULL DEFAULT 'draft' CHECK IN ('calibrated','needs_review','draft')
- `confidence_score` numeric NOT NULL DEFAULT 0.6 CHECK 0..1
- `calibration_name` text NULL

Mais um índice `(component_item_id, created_at DESC)` para acelerar "última calibração ativa".

A tabela continua append-only — nenhuma policy de UPDATE é adicionada.

### 2. Motor `physical_simple`

Já aplica `capacityCorrectionFactor`, `airDpCorrectionFactor`, `refDpCorrectionFactor` e `uaCorrectionFactor` internamente. Vou:

- Garantir aplicação única: o resultado final já vem com fatores → `applyCalibrationToResult` NUNCA será chamada por cima.
- Adicionar `heatTransferFactor` no breakdown como alias semântico de `capacityCorrectionFactor` (rastreabilidade).

### 3. Motores empíricos

`dxEvaporatorSimulator.ts` e `dxCondenserSimulator.ts` ganham parâmetro opcional `calibration?: CalibrationFactors`. Quando informado, multiplicam no final:

```text
capacityW           *= capacityCorrectionFactor
airPressureDropPa   *= airDpCorrectionFactor
refPressureDropKpa  *= refDpCorrectionFactor
sensibleW / latentW *= capacityCorrectionFactor (proporcional)
```

### 4. Utilitário `coil-calibrations.ts`

Adicionar:

- `getActiveCalibrationForComponent(componentItemId)` — última calibração por `created_at DESC LIMIT 1`.
- `getActiveCalibrationsForComponent(componentItemId)` — histórico (já existe como `listCoilCalibrations`, vou só renomear/expor).
- `applyCalibrationToResult(result, calibration)` — multiplicador puro. Documentado: USAR APENAS no engine empírico, NUNCA depois do `physical_simple`.
- `saveCoilCalibration` ganha campos `status`, `confidence_score`, `calibration_name`.
- `factorsFromRow(row)` — converte registro do banco em `CalibrationFactors`.

### 5. `coilCalibration.ts` — novo `calibrateCoilFromDatasheet`

Substitui (mantendo compatibilidade) `calibrateAgainstReference`. Assinatura:

```ts
calibrateCoilFromDatasheet({
  input: CoilSimulatorInput,
  datasheet: {
    capacityW: number;
    airInletTempC?: number;
    airOutletTempC?: number;
    evaporationTempC?: number;
    condensationTempC?: number;
    airflowM3h?: number;
    airPressureDropPa?: number | null;
    refrigerantPressureDropKpa?: number | null;
    refrigerant?: string;
    coilType: "evaporator" | "condenser";
  };
})
```

Fluxo:

```text
1. baseline = simulatePhysicalSimple(input, NEUTRAL_CALIBRATION)
2. factors = clamp({
     capacity = ds.capacityW / baseline.capacityW,
     airDp    = (ds.airDp && baseline.airDp) ? ds.airDp / baseline.airDp : 1,
     refDp    = (ds.refDp && baseline.refDp) ? ds.refDp / baseline.refDp : 1,
     ua       = 1,
   }, 0.3, 3.0)
   heatTransferFactor = factors.capacity
3. calibrated = simulatePhysicalSimple(input, factors)
4. devBefore / devAfter = (val - ds) / ds * 100
5. status = "calibrated" se:
     |devAfter.capacity| ≤ 5 AND
     (ds.airDp ausente OR |devAfter.airDp| ≤ 10) AND
     (ds.refDp ausente OR |devAfter.refDp| ≤ 15)
   senão "needs_review"
6. confidence = confidenceScoreFor(status, 1)
7. retorna { status, confidenceScore, factors, heatTransferFactor,
             baselineResult, calibratedResult,
             deviationsBefore, deviationsAfter, warnings }
```

Regras enforced:
- ΔP ar/refrig ausente → fator = 1.0, alvo não validado, sem warning falso.
- Nunca inventa dado; nunca toca `raw_fields`.

### 6. Painel reutilizável `calibration-panel.tsx`

Novo componente em `src/components/coldpro/calibration-panel.tsx`:

```text
Props: { componentItemId, coilType, nominalReference, simulationInput }

Layout:
- Header: badge status (Calibrado / Revisão / Sem calibração)
          + barra de confiança (Progress 0..100%)
- Tabela "Antes vs Depois":
    Métrica          | Antes  | Depois | Meta
    Capacidade       | +18.4% | -2.1%  | ≤5%
    ΔP ar            | …      | …      | ≤10%
    ΔP refrigerante  | …      | …      | ≤15%
- Tabela "Fatores aplicados":
    Capacidade        ×1.184
    ΔP ar             ×0.95
    ΔP refrigerante   ×1.10
    Heat transfer     ×1.184
- Botões:
    [ Calibrar com datasheet ]   (disabled se sem nominalReference)
    [ Recalibrar ]               (idem, mas explícito)
- Histórico (últimas 5):
    data · usuário · status · |ΔQ| pós
```

Usa `useQuery` para `getActiveCalibrationForComponent` e `useMutation` para chamar `calibrateCoilFromDatasheet` + `saveCoilCalibration`.

### 7. Integração nas abas Evaporador/Condensador

`src/components/coldpro/evaporator-tab.tsx` e `condenser-tab.tsx`: após o bloco de campos técnicos, montar:

```tsx
<CalibrationPanel
  componentItemId={item.id}
  coilType="evaporator"
  nominalReference={{
    capacityW: model.nominal_capacity_w,
    airInletTempC: model.nominal_air_temp_in_c,
    evaporationTempC: model.nominal_evap_temp_c,  // ou condensationTempC
    airflowM3h: model.nominal_airflow_m3h,
    airPressureDropPa: model.air_pressure_drop_pa,
    refrigerantPressureDropKpa: model.refrigerant_pressure_drop_kpa,
    refrigerant: model.refrigerant,
  }}
  simulationInput={buildInputFromModel(model)}
/>
```

`buildInputFromModel` é um helper local que monta `CoilSimulatorInput` a partir do registro `evaporator_coil_models` / `condenser_coil_models`.

### 8. Header do Coil Simulator

Em `src/routes/_app/coldpro/equipamentos/$id/coil-simulator.tsx`:

- Substitui o `<Alert>` atual de calibração por uma faixa enxuta com:
  - Badge de status
  - "Confiança: 85%"
  - "Motor: Físico simples / Empírico"
  - Link "ver detalhes" → expande tabela de fatores
- Garante que `handleCalculate`:
  - `physical_simple`: passa calibração para o motor (já faz)
  - `empirical`: chama `applyCalibrationToResult(empResult, calibration)` quando há calibração ativa
  - **Nunca** ambos.

### 9. Regras de imutabilidade já garantidas

- `coil_calibrations` sem policy de UPDATE.
- `raw_fields` dos `*_coil_models` nunca tocados pela calibração.
- Snapshots (`inputs_snapshot`, `outputs_snapshot`) capturados em cada calibração.
- Recalibrar = INSERT novo registro; o anterior fica para histórico.

### 10. Critérios de validação (built-in)

A função retorna `meetsTargets` baseada em:
- Capacidade ≤ 5%
- ΔP ar ≤ 10% (só se presente no datasheet)
- ΔP refrigerante ≤ 15% (só se presente no datasheet)

Painel mostra explicitamente o status e cada métrica colorida (verde/âmbar/vermelho).

---

### Arquivos

**Novos**
- `src/components/coldpro/calibration-panel.tsx`

**Modificados**
- `supabase/migrations/...` — ALTER TABLE com 3 colunas + índice
- `src/modules/coldpro/coil/coilEngineTypes.ts` — `CalibrationStatus`, `confidenceScoreFor`
- `src/modules/coldpro/coil/coilCalibration.ts` — adiciona `calibrateCoilFromDatasheet` (mantém `calibrateAgainstReference` como wrapper para retrocompat)
- `src/modules/coldpro/coil/physicalSimpleEngine.ts` — adiciona `heatTransferFactor` no breakdown
- `src/modules/coldpro/coil/dxEvaporatorSimulator.ts` — aceita `calibration?` e aplica no final
- `src/modules/coldpro/coil/dxCondenserSimulator.ts` — idem
- `src/lib/coldpro/coil-calibrations.ts` — `applyCalibrationToResult`, `factorsFromRow`, `getActiveCalibrationForComponent`, salvar `status`/`confidence_score`/`calibration_name`
- `src/components/coldpro/evaporator-tab.tsx` — monta `CalibrationPanel`
- `src/components/coldpro/condenser-tab.tsx` — monta `CalibrationPanel`
- `src/routes/_app/coldpro/equipamentos/$id/coil-simulator.tsx` — header com badge de confiança + aplicação correta da calibração no engine empírico

### Não-objetivos desta iteração
- Múltiplos pontos (curva). Vai junto com "curva de desempenho" no próximo passo.
- Refator das correlações físicas (Wang/Cavallini).
- Telas admin de gestão de calibrações.