## Objetivo

Substituir a fonte do FanPicker do CN Coils (hoje vinda de `/data/equipment/fans.json` + `/data/catalogs/fans.json` + tabela `fans_catalog` do Supabase, sem curvas reais) pelo novo catálogo Ziehl-Abegg fornecido (`cn_coils_fans_catalog.ts`, 9 modelos com curvas Q×ΔP de 8–10 pontos extraídas dos datasheets).

Os engines de cálculo (`simulatorCore`, `cycleEngine`, `findFanOperatingPoint`) **não serão modificados**.

## Mudanças

### 1. Instalar o novo catálogo
- Copiar `cn_coils_fans_catalog.ts` (do upload) para **`src/modules/cn_coils/data/fanCatalog.ts`** sem alterações de conteúdo.
- Exporta: `FAN_CATALOG`, `FanModel`, `FanCurvePoint`, `interpolatePressure`, `interpolatePower`, `findOperatingPoint`.

### 2. Esvaziar fontes antigas usadas pelo picker
- **`src/modules/cn_coils/hooks/useZiehlAbeggFanPickerItems.ts`** — manter o arquivo e a interface, mas retornar `items: []` (sem fetch de `/data/catalogs/fans.json`). Mantém as interfaces TS intactas, conforme pedido.
- **`src/modules/cn_coils/hooks/useFansCatalog.ts`** — manter arquivo e tipos, mas retornar `data: []` (sem chamada ao Supabase). O hook hoje não é usado pelo picker; é só limpeza preventiva.
- **Não** mexer em arquivos `.json` em `public/data/` nem em outros catálogos do `coldpro_v2`. **Não** mexer em `useEquipmentLibrary` (usado por outros módulos coldpro).

### 3. Novo hook de adaptação
Criar **`src/modules/cn_coils/hooks/useFanCatalogPickerItems.ts`** que mapeia cada `FanModel` do `FAN_CATALOG` para um `FanPickerItem` (interface já existente em `FanPickerModal.tsx`):

```text
FanModel.model           → FanPickerItem.model
FanModel.manufacturer    → manufacturer ("Ziehl-Abegg")
FanModel.diameter_mm     → diameter_mm
FanModel.rpm_nominal     → rpm
FanModel.p1_nominal_w    → motor_power_w
"FN" / "FN-EC" derivado  → series, fanCategory: "axial",
                           fanFunction: "soprador"
id = `ZA_${model}`       → id estável
airflow_m3h = ponto da curva onde psf_pa ≈ 0 (último ponto) ou
              ponto recomendado de operação (~ q_max × 0.6)
```

Sem warnings hardcoded; sem fallback inventado.

### 4. Reescrever `useEnrichedFanPickerItems`
Substituir o conteúdo de **`src/modules/cn_coils/hooks/useEnrichedFanPickerItems.ts`** para que ele retorne **exclusivamente** os 9 ventiladores do `FAN_CATALOG` via `useFanCatalogPickerItems`. Mantém a assinatura `{ items, loading, error }` para que `AirSidePanel.tsx`, `EvaporatorUnifiedWorkspacePage.tsx` e `CondenserWorkspacePage.tsx` continuem funcionando sem alteração.

### 5. Verificações
- `bunx tsc --noEmit` deve passar (interfaces preservadas).
- Abrir o FanPicker no workspace evaporador (rota atual `/coldpro/cncoils/workspace?type=evaporator_dx`) e confirmar que aparecem exatamente os 9 modelos: FN035-4DK.0F.V7P2, FN035-4EK.0F.V7P2, FN040-4DK.0F.V7P1, FN040-4EK.2F.V7P1, FN045-4DQ.4I.V7P1, FN050-4DK.4I.V7P1, FN056-4DK.4M.V7P2, FN063-4DK.6N.V7P6, FN080-6DQ.6N.V7.

## Fora de escopo (intencionalmente)

- **Não** alterar `simulatorCoreAdapter` para popular `result.fanEvaluation` (recusado em rodada anterior). A integração da curva no cálculo continua sendo feita só onde já existe (`findFanOperatingPointSimple`); a UI continua mostrando "—" em pressão estática até essa wiring ser aprovada separadamente.
- **Não** apagar arquivos `.json` em `public/data/catalogs/` (são consumidos por outros catálogos como `fansComplete`, `coilCorrections`, etc.).
- **Não** mexer em engines, validadores, ou tabelas do Supabase.

## Arquivos afetados

- + `src/modules/cn_coils/data/fanCatalog.ts` (novo, ~640 linhas)
- + `src/modules/cn_coils/hooks/useFanCatalogPickerItems.ts` (novo, ~50 linhas)
- ~ `src/modules/cn_coils/hooks/useEnrichedFanPickerItems.ts` (reescrito, fino)
- ~ `src/modules/cn_coils/hooks/useZiehlAbeggFanPickerItems.ts` (retorna lista vazia)
- ~ `src/modules/cn_coils/hooks/useFansCatalog.ts` (retorna lista vazia)
