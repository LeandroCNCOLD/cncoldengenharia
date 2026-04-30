## Objetivo

Conectar a interface ao Catálogo 480 consolidado (`cn_equipment_master` + masters de evap/cond/comp/perf), permitindo navegar 481 modelos, criar `equipment_project` completo a partir de um modelo, abrir o Coil Simulator já preenchido e exibir a origem do equipamento na tela de detalhes.

## Backend

### 1. `src/server/cn480Catalog.server.ts`
Helpers server-only:
- `loadCn480List(supabase)` — `SELECT m.*, em.id as evap_id, cm.id as cond_id, comp.copeland/bitzer/danfoss/dorin/secondary, perf.cnt` via joins. Retorna lista achatada com flags `has_evaporator`, `has_condenser`, `has_compressor`, `perf_points`, `compressor_label`.
- `loadCn480Detail(supabase, modelId)` — retorna `{ master, evaporator, condenser, compressor, performance[] }`.
- `mapEvaporatorToCoilModel(detail)` / `mapCondenserToCoilModel(detail)` — converte schemas master → schema dos `*_coil_models` (mapeia `tube_diameter`→`tube_od_mm`, `tube_thickness`→`fin_thickness_mm` quando aplicável, `fin_spacing`→`fin_pitch_mm`, `airflow`→`nominal_airflow_m3h`, `internal_volume`→`internal_volume_l`, `exchange_area`→`surface_area_m2`, `tubes_per_row`/`rows`/`circuits` diretos).
- `pickNominalPerformancePoint(perf[])` — escolhe o ponto nominal (menor `point_index` ou heurística por COP máximo, definida no plano).
- `pickCompressorLabel(comp)` — primeiro não-nulo entre copeland/bitzer/danfoss/dorin/secondary com fabricante.

### 2. `src/server/cn480Catalog.functions.ts`
Server functions com `[attachSupabaseAuth, requireSupabaseAuth]`:
- `listCn480Catalog()` — GET, retorna lista com filtros opcionais (linha, refrigerante, busca textual). Sem paginação inicial (481 linhas).
- `getCn480Detail({ modelId })` — GET, retorna detalhe completo.
- `createEquipmentFromCn480({ modelId })` — POST. Em uma sequência:
  1. Carrega detalhe.
  2. Insere `equipment_projects` (code = `modelo`, commercial_name = `modelo`, refrigerant, equipment_kind/application heurístico por `linha` LT/MT, status `draft`, notes referenciando origem).
  3. Cria `component_items` (kind `evaporador`) + upsert `evaporator_coil_models` com mapeamento + `nominal_evap_temp_c` / `nominal_capacity_w` do ponto nominal.
  4. Cria `component_items` (kind `condensador`) + upsert `condenser_coil_models` com mapeamento + `nominal_cond_temp_c`.
  5. Salva compressor textual em `equipment_projects.notes` ou em `raw_sources_json` do projeto via campo `raw_fields` do `component_items` `compressor` (criamos um `component_item` kind `compressor` com `manufacturer`/`model`/`raw_fields`).
  6. Vincula refrigerante já no projeto.
  7. Persiste rastreabilidade: cada `component_items.raw_fields.source = "cn_equipment_master"`, `catalog_model_id`, `catalog_model`. Também grava `raw_sources_json` snapshot dentro de `raw_fields` para o evaporador (cópia do master).
  8. Retorna `{ equipmentProjectId, created: {...} }`.

  Idempotência: se já existe `equipment_project` com `code = modelo` e flag `raw_fields.source=cn_equipment_master` no projeto (via `notes`/`code`), retorna o existente em vez de duplicar — controlamos por `code` (UNIQUE não existe; checamos manualmente).

### 3. AutoFill — prioridade Catálogo 480
Editar `src/server/equipmentAutoFill.server.ts` e `equipmentAutoFill.functions.ts`:
- Nova função `findMasterForEquipment(supabase, code, commercial_name)` que busca em `cn_equipment_master` (igualdade case-insensitive em `modelo`, depois fallback `ilike %x%`).
- Em `previewAutoFillFromCnCatalog` e `commitAutoFillFromCnCatalog`, antes de chamar `findCurveForEquipment`, tentar `findMasterForEquipment`. Se houver match: usar dados de evap/cond/perf masters via `mapEvaporator/CondenserToCoilModel`. Caso contrário, manter caminho atual (`cn_catalog_performance_curves`). Adicionar campo `source: "cn_equipment_master" | "cn_catalog_performance_curves"` no preview.
- Nenhuma alteração em motor/mapper/importação.

## Frontend

### 4. Rota `src/routes/_app/coldpro/catalogo-480.tsx`
File-based route que renderiza `Cn480CatalogPage`. Sidebar: nova entrada **"Catálogo 480"** entre "Catálogo Técnico" e "Administração" em `src/components/app-sidebar.tsx`.

### 5. `src/components/coldpro/cn480-catalog-page.tsx`
Página com:
- `PageHeader` "Catálogo 480 — modelos consolidados".
- Filtros: input de busca (modelo), select linha, select refrigerante.
- Tabela (`Table`) com colunas: Modelo · Linha · HP · Refrigerante · Compressor · Evap · Cond · Perf · Status · Ações.
  - Badges verdes/cinzas para `has_*`.
  - Status: "Pronto" (todos presentes), "Parcial" (algum faltando), "Vazio".
- Ações por linha:
  - **Criar equipamento** → `useServerFn(createEquipmentFromCn480)`. Em sucesso: toast + navega para `/coldpro/equipamentos/$id`.
  - **Abrir no Coil Simulator** (visível só se já existe projeto vinculado, opcional) → navega para `/coldpro/equipamentos/$id/coil-simulator`. No primeiro release: o botão sempre cria-ou-reutiliza e depois navega para o coil simulator (rota já existe em `src/routes/_app/coldpro/equipamentos/$id/coil-simulator.tsx`).

Detalhe expandido (Drawer ao clicar na linha): mostra raw geometry, ponto nominal, compressor textual.

### 6. Card "Origem: Catálogo 480" no equipamento
Editar `src/routes/_app/coldpro/equipamentos/$id.tsx` (ou o componente principal renderizado por ela):
- Buscar `component_items` do projeto e detectar se algum tem `raw_fields.source === "cn_equipment_master"` (ou checar `equipment_project.notes`).
- Se sim, renderizar acima de `EquipmentReadinessPanel` um card resumo:
  - Título "Origem: Catálogo 480" + badge.
  - Linhas: modelo de origem, evaporador preenchido (geometria resumida), condensador preenchido, compressor textual, refrigerante, ponto nominal (Tevap/Tcond/Capacidade/COP).
  - Botão "Abrir no Coil Simulator".

### 7. Coil Simulator pré-preenchido
A rota `coil-simulator.tsx` já carrega evaporator/condenser_coil_models por `component_item_id`. Verificar e, se necessário, garantir que ela:
- Carrega ponto nominal de `equipment_projects` ou de `raw_fields.nominal_point` (gravamos isso no commit).
- Mostra "vs Catálogo": comparar `outputs` calculado x `nominal_capacity_w`/`nominal_cond_temp_c` do master, com badge OK/divergente (>10%). Reaproveita componente `coil-tab-header`/`equipment-readiness-panel` quando possível.

(Se o escopo do simulador for grande, o ajuste comparativo entra como segundo passo dentro do mesmo PR.)

## Não-objetivos

- Não alterar `src/modules/thermalcalc/**` (motor).
- Não alterar `src/modules/coldpro/library/mappers/**`.
- Não reimportar `Tabela 480.xlsx`.
- Não criar nova tabela no banco (usa apenas `cn_equipment_*` existentes).

## Detalhes técnicos

- Mapeamento de campos master → coil_models tratado em `cn480Catalog.server.ts` para ficar isolado e testável; números nulos permanecem nulos (sem coerção a 0).
- `equipment_kind`/`application` derivados de `linha` (`LT*` → `congelados`, `MT*` → `resfriados`, default `outro`); `family` recebe `linha`.
- Heurística de "ponto nominal" do catálogo: ponto com menor `point_index`; se houver múltiplos, o de maior `cop`.
- Busca textual feita client-side no `useQuery` (lista pequena ~481).
- Idempotência: verifica `equipment_projects.code = modelo`. Se existir, `createEquipmentFromCn480` retorna o `id` existente sem duplicar evap/cond.
- RLS já permite SELECT/INSERT por `authenticated` em todas as tabelas envolvidas.

## Arquivos novos/alterados

Novos:
- `src/server/cn480Catalog.server.ts`
- `src/server/cn480Catalog.functions.ts`
- `src/routes/_app/coldpro/catalogo-480.tsx`
- `src/components/coldpro/cn480-catalog-page.tsx`
- `src/components/coldpro/cn480-origin-card.tsx`

Editados:
- `src/components/app-sidebar.tsx` (entrada "Catálogo 480")
- `src/server/equipmentAutoFill.server.ts` (helper `findMasterForEquipment` + mappers)
- `src/server/equipmentAutoFill.functions.ts` (preview/commit priorizando master)
- `src/routes/_app/coldpro/equipamentos/$id.tsx` (renderiza `Cn480OriginCard` quando aplicável)
- `src/routes/_app/coldpro/equipamentos/$id/coil-simulator.tsx` (carregar ponto nominal + comparativo, se necessário)

## Resultado esperado

Usuário acessa **Catálogo 480** no menu, vê os 481 modelos com flags de completude, clica em **Criar equipamento** num modelo válido (ex.: `CN_1200_LT_COPELAND_ZF41K5E_380V_3F_60HZ`) e cai num `equipment_project` com evaporador + condensador preenchidos, compressor identificado, refrigerante R404A e card "Origem: Catálogo 480". Botão **Abrir no Coil Simulator** leva direto à simulação com geometria + ponto nominal carregados.