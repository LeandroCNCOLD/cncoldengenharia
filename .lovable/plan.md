# Unificar ventiladores Ziehl-Abegg + EBM-Papst num só catálogo

## Situação atual

Hoje o `FanLibraryBrowser` / `FanPickerModal` é alimentado pelo hook
`useEnrichedFanPickerItems`, que lê **apenas** `/public/data/equipment/fans.json`
(185 modelos EBM-Papst, com coeficientes SPH).

Mas o projeto já tem um segundo catálogo, mais rico em metadados, em
`/public/data/catalogs/fans.json`: **459 modelos Ziehl-Abegg** com campos
prontos (`model`, `series`, `builder`, `airflowM3h`, `powerW`, `speedRpm`,
`currentA`, `voltageV`, `frequencyHz`, `fanCategory`, `fanFunction`).
Ele só está sendo consumido pelo `useCnCoilsCatalogCollection` (uso interno
do solver), nunca aparece no seletor de ventiladores da interface.

Resultado: ao abrir o picker, o usuário só vê EBM-Papst.

## O que vamos fazer

Unir as duas bibliotecas num único stream do picker, sem duplicar nada e
preservando a marca/série/motor de cada modelo.

### 1. Novo hook `useZiehlAbeggFanPickerItems`

Arquivo: `src/modules/cn_coils/hooks/useZiehlAbeggFanPickerItems.ts`

- Carrega `/data/catalogs/fans.json` via `fetch` (mesmo padrão do `useFanLibrary`).
- Mapeia cada linha para `FanPickerItem`:

```text
id              → `ZIEHL_${row.id}_${slug(row.model)}`
manufacturer    → row.builder            // "Ziehl-Abegg"
model           → row.model              // ex.: "TLI 9-9"
series          → row.series             // "TLI", "FN", "RDH" …
fanCategory     → row.fanCategory        // "axial" | "centrifugal"
fanFunction     → row.fanFunction        // soprador|exaustor|livre|universal
airflow_m3h     → row.airflowM3h
motor_power_w   → row.powerW
motor_current_a → row.currentA
voltage_v       → row.voltageV
frequency_hz    → row.frequencyHz
rpm             → row.speedRpm
diameter_mm     → derivado do modelo quando possível (regex p/ "TLI 9-9" → 900 mm,
                  "FN050" → 500 mm). Quando o regex não casar, deixa undefined.
```

- Retorna `{ items, loading, error }` no mesmo formato que o hook EBM.

### 2. Atualizar `useEnrichedFanPickerItems`

Arquivo: `src/modules/cn_coils/hooks/useEnrichedFanPickerItems.ts`

- Manter toda a lógica EBM-Papst atual (decode do código, estimativa SPH).
- Importar e chamar `useZiehlAbeggFanPickerItems`.
- Concatenar: `[...ebmItems, ...ziehlItems]`, ordenados por
  `manufacturer + model`.
- Combinar `loading` (OR) e `error` (primeiro não-nulo) das duas fontes.

Como `FanPickerModal` / `FanLibraryBrowser` já consomem esse hook nas três
páginas (Evaporador, Condensador, Genérico) via `AirSidePanel`, **nenhuma
alteração de UI** é necessária — assim que o hook devolver os 644 modelos,
os filtros de fabricante, série, categoria e função já funcionam.

### 3. Verificações pós-mudança

- Abrir o picker no workspace de Evaporador, Condensador e Genérico e
  confirmar que aparecem os dois fabricantes no filtro.
- Conferir que selecionar um Ziehl-Abegg grava um `selectedFanId` válido
  (prefixo `ZIEHL_…`) no `useCnCoilsSimulationStore`.
- Rodar `bunx tsc --noEmit` e `bun run lint`.

## Fora do escopo

- Não vamos alterar o solver/back-end: o cálculo térmico continua usando os
  coeficientes do catálogo interno (`useCnCoilsCatalogCollection`). A união
  aqui é apenas no **seletor de ventilador** (metadados/UX).
- Sem migrações de banco, sem mudanças nos arquivos JSON de origem.
