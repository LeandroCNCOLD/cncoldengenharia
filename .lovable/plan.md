## Diagnóstico do estado atual

**Dados raw importados com sucesso** (Etapa 8 OK):
- `unilab_source_files`: 471 arquivos
- `unilab_source_rows`: 158.048 linhas (raw_json)
- 11 source_databases mapeadas (Coils6, Fluids, Materiais, Compressor, Frames, Danfoss, HeatSeries, LinePressureDrop, Recuperatori, FluidManagement, EQUACOES_POLINOMIAIS)

**Tabelas tipadas com dados** (parcial):
- `coil_geometry_factors`: 500 linhas
- `coil_fluids`: 10 / `coil_materials`: 6

**Tabelas tipadas vazias — bloqueiam o ciclo completo**:
- `unilab_geometries` (0) — geometrias normalizadas
- `compressor_models` (0) e `compressor_polynomials` (0) — bloqueia simulação de sistema completo
- `fan_models` (0) e `fan_curves` (0) — bloqueia perda de carga real
- `refrigerants` (0) e `refrigerant_polynomials` (0) — bloqueia propriedades termodinâmicas reais

Conclusão: o motor híbrido hoje roda em modo "geometria + fatores", mas **sem compressor real, sem ventilador real e sem polinômios de refrigerante** ele não fecha equilíbrio com dados reais.

---

## O que esta etapa entrega

### Bloco 1 — Mappers raw → tipado (server functions)

Server function `runColdproMappers` que lê `unilab_source_rows` e popula:

1. **Geometrias** (`unilab_geometries`)
   - Fonte: `01_Coils6_Principal` → `Tbl_Geometrie`, `Tbl_Geom_Std`
   - Normaliza: geometry_code, fin_pitch, tube_pitch, row_pitch, OD/ID tubo, fin_thickness, rows, circuits

2. **Compressores** (`compressor_models` + `compressor_polynomials`)
   - Fonte: `04_Standard_Compressor` (Tbl_Compressor_Model, Tbl_Compressor_Capacity, AbsorbedPower, Current) + `EQUACOES_POLINOMIAIS` (abas de compressores)
   - Normaliza: fabricante, modelo, deslocamento, refrigerante, voltagem, frequência
   - Cria 1 linha de polinômio por curva (capacity, absorbed_power, current) com `curve_type` + `coefficients_json` (10 coef. ANSI/AHRI 540) + faixa T_evap / T_cond

3. **Ventiladores** (`fan_models` + `fan_curves`)
   - Fonte: `01_Coils6_Principal` → `Tbl_Fan_Model`, `Tbl_Fan_Centr_Dati`, `Tbl_Fan_Axial_*`, `Tbl_Fan_Centr_Curve`
   - Normaliza: fabricante, modelo, tipo (axial/centrífugo), diâmetro, vazão/pressão/potência nominais
   - Cria curvas (table_data_json) para axiais e centrífugos

4. **Refrigerantes + polinômios** (`refrigerants` + `refrigerant_polynomials`)
   - Fonte: `EQUACOES_POLINOMIAIS` (abas R134a, R404A, R407C, R410A, R290, R32, R744, R1234yf, etc.)
   - 1 refrigerante por código + N polinômios por propriedade (P_sat, ρ_liq, ρ_vap, h_liq, h_vap, c_p, λ, μ)

5. **Geometry factors** já estão populados (500 linhas) — pular.

UI: botão **"Executar mapeamento tipado"** na página `/admin/coldpro-import` que dispara cada mapper individualmente (ou todos), mostra progresso e resumo (rows inseridas / puladas / erro) por destino.

---

### Bloco 2 — Página de Catálogo Técnico

Rota: **`/coldpro/catalogo`** (com sub-abas)
- Aba **Compressores**: tabela filtrável (fabricante, refrigerante, faixa de capacidade, tipo) → click abre ficha técnica com curvas polinomiais plotadas
- Aba **Ventiladores**: filtros (tipo, diâmetro, vazão) → ficha + curva PxQ
- Aba **Refrigerantes**: lista com GWP, ODP, família → ficha com gráficos das propriedades
- Aba **Geometrias**: lista de geometry_codes com mini-diagrama dos parâmetros + fatores associados

Cada ficha tem botão "Usar este equipamento em projeto" → leva para seleção de projeto e atribui o componente.

---

### Bloco 3 — Página de Seleção Automática

Rota: **`/coldpro/selecao`**

Formulário de entrada:
- Refrigerante, T_evap (°C), T_cond (°C), Capacidade alvo (W), SH/SC, ambiente

Server function `selectEquipment`:
1. Filtra compressores que cobrem a faixa (T_evap, T_cond) com capacidade ±15% no polinômio
2. Para cada candidato → roda `systemSimulator` simplificado (compressor + condensador padrão + evaporador padrão) e calcula equilíbrio
3. Ranqueia por: COP, proximidade da capacidade alvo, consumo, faixa de operação
4. Retorna top 5 com tabela comparativa + botão "Criar projeto com esta seleção" (cria `equipment_project` + `component_items` ligados)

---

### Bloco 4 — Proposta Técnica Automática

Rota: **`/coldpro/equipamentos/$id/proposta`**

Lê o projeto + última simulação de sistema completo + componentes selecionados e gera ficha técnica com:
- Cabeçalho (código, nome comercial, aplicação)
- Tabela de equipamentos selecionados (compressor, condensador, evaporador, ventilador) com origem (Unilab/calibrado/estimado)
- Condições de projeto e ponto de equilíbrio (capacidade, COP, consumo, vazão de massa)
- Curvas de desempenho (mapa)
- Avisos / nível de confiança

Botão **"Exportar PDF"** usando `react-to-print` ou geração HTML imprimível (sem dependência Node-only — Worker-safe).

---

## Arquivos a criar / editar

**Server**
- `src/server/coldproMappers.functions.ts` — server function principal `runColdproMappers({ targets: ['geometries'|'compressors'|'fans'|'refrigerants'|'all'] })`
- `src/server/mappers/geometries.ts`
- `src/server/mappers/compressors.ts`
- `src/server/mappers/fans.ts`
- `src/server/mappers/refrigerants.ts`
- `src/server/equipmentSelector.functions.ts` — seleção automática

**Routes (TanStack)**
- `src/routes/_app/coldpro/catalogo.tsx` (layout + tabs)
- `src/routes/_app/coldpro/catalogo.compressores.tsx`
- `src/routes/_app/coldpro/catalogo.ventiladores.tsx`
- `src/routes/_app/coldpro/catalogo.refrigerantes.tsx`
- `src/routes/_app/coldpro/catalogo.geometrias.tsx`
- `src/routes/_app/coldpro/selecao.tsx`
- `src/routes/_app/coldpro/equipamentos/$id/proposta.tsx`

**UI**
- `src/components/coldpro/catalog/*` (CompressorCard, FanCard, RefrigerantCard, GeometryCard, PolynomialChart)
- `src/components/coldpro/selecao-form.tsx` + `selecao-results.tsx`
- `src/components/coldpro/proposta-pdf.tsx`
- Editar `src/routes/_app/admin_.coldpro-import.tsx` → adicionar painel "Mapeamento tipado"
- Adicionar links no menu / dashboard ColdPro

**Supabase**
- Nenhuma migração nova necessária (todas as tabelas já existem). Apenas população via mappers.

---

## Sequência de execução

Recomendo entregar em **2 PRs separados** dentro desta etapa para isolar risco:

**Fase A — Mappers (Bloco 1)**
- Implementa as 4 server functions de mapping
- Adiciona painel no `/admin/coldpro-import`
- Roda mapeamento e valida contagens (esperado: ~50–100 compressores, ~400 fans, ~10 refrigerantes, ~50 geometrias, milhares de polinômios)

**Fase B — Páginas finais (Blocos 2, 3, 4)**
- Catálogo + Seleção + Proposta usando os dados já mapeados

Posso começar pela **Fase A** agora? Assim que os dados tipados estiverem populados, a Fase B fica trivial (só consome tabelas já normalizadas).