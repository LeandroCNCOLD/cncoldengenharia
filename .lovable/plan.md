
# Coil Simulator — Fundação Técnica (Iteração 1)

## Princípio
Em vez de saltar para correlações avançadas, criamos uma **fundação calibrável e auditável**: bancos técnicos, geometria derivada, motor físico simples (`Q = U·A·LMTD`) e comparação lado a lado contra Unilab e contra o motor empírico atual. Nada do que existe hoje é removido.

Toggle de motor:
```
engine: "empirical" | "physical_simple" | "physical_advanced"
```
Apenas **`empirical`** (já existe) e **`physical_simple`** (novo) entram em operação. `physical_advanced` fica reservado nos tipos para fases futuras (Wang, Cavallini, Kandlikar, etc.).

---

## 1. Bancos técnicos (novas tabelas)

### `coil_materials`
- `id`, `key` (cobre, aluminio, aco_carbono, inox, microfin, aleta_lisa, aleta_corrugada, aleta_louvered)
- `name`, `kind` ("tube" | "fin")
- `thermal_conductivity_w_mk` (numeric)
- `density_kg_m3`, `specific_heat_j_kgk`, `roughness_mm`
- `default_thickness_mm`, `surface_correction_factor`
- `notes`, `created_at`, `updated_at`

### `coil_fluids`
- `id`, `key` (R404A, R507, R134a, R448A, R449A, R410A, R32, R290, R744, R717, AGUA, EG30, PG30)
- `name`, `family` ("hfc" | "hfo" | "natural" | "secondary")
- `saturation_table` (jsonb): array `{T_c, Psat_kpa, h_l_kjkg, h_v_kjkg, rho_l, rho_v, mu_l, mu_v, k_l, k_v, cp_l, cp_v}`
- `gwp`, `notes`

### `coil_geometries`
- `id`, `name`, `description`
- Todos os campos geométricos de `CoilGeometry` (tubos, fileiras, passos, materiais por FK opcional para `coil_materials`).
- `is_template` (boolean) — geometrias-template reutilizáveis.
- `created_by`, `created_at`, `updated_at`

RLS:
- SELECT: `authenticated` (todos leem).
- INSERT/UPDATE/DELETE: apenas `has_role(auth.uid(), 'admin')` para `coil_materials` e `coil_fluids`. `coil_geometries` é livre para `authenticated` criarem suas próprias.

Seed inicial via migration:
- Materiais: cobre (k=401), alumínio (k=237), aço carbono (k=50), inox 304 (k=16).
- Fluidos: R-404A, R-134a, R-448A, R-449A, R-744, R-717, água, EG30 — tabela de saturação simplificada (≈10 pontos por fluido).

Módulos de leitura cacheada:
- `src/modules/coldpro/data/materials.ts`
- `src/modules/coldpro/data/fluids.ts` (com helper `interpFluidProps(fluidKey, T_c)`)
- `src/modules/coldpro/data/geometries.ts`

---

## 2. Geometria derivada

Novo módulo `src/modules/coldpro/coil/geometryDerived.ts` com função pura:
```
deriveGeometry(g: CoilGeometry) => {
  totalTubes,             // tubesPerRow * rows - skippedTubes
  totalTubeLengthM,       // totalTubes * coilLengthMm/1000
  faceAreaM2,             // (tubesPerRow * tubeSpacingMm) * coilLengthMm / 1e6
  externalAreaM2,         // π * tubeOd * L_total * (1 + finRatio)
  internalAreaM2,         // π * tubeId * L_total
  internalVolumeL,        // π/4 * tubeId² * L_total * 1000
  finRatio,               // razão área aleta/tubo (estimada de finPitch e geometria)
  source: { [field]: "calculated" | "imported" | "estimated" }
}
```
Usado em todos os formulários (mostra valores derivados read-only com badge de origem) e dentro do motor físico.

---

## 3. Calibração Unilab — `coil_calibrations`

Tabela:
- `id`, `component_item_id` (FK lógica para `component_items`)
- `engine_target` ("physical_simple" | "physical_advanced")
- `capacity_correction_factor` numeric default 1.0
- `air_pressure_drop_factor` numeric default 1.0
- `refrigerant_pressure_drop_factor` numeric default 1.0
- `heat_transfer_correction_factor` numeric default 1.0
- `nominal_point` (jsonb) — ponto do datasheet usado: `{Tair_in, RH_in, Tref, airflow, Q_unilab, dPair_unilab, dPref_unilab, U_unilab, A_unilab}`
- `deviation_before` (jsonb) — `{capacityPct, dPairPct, dPrefPct}` antes da calibração
- `deviation_after` (jsonb) — `{capacityPct, dPairPct, dPrefPct}` depois
- `meets_targets` (boolean) — true quando os 3 desvios estão dentro das metas
- `created_by`, `created_at`, `updated_at`

RLS: `authenticated` SELECT/INSERT/UPDATE.

Função `calibrateAgainstUnilab(componentItemId)`:
1. Lê o ponto nominal do `evaporator_coil_models` / `condenser_coil_models`.
2. Roda `physical_simple` no mesmo ponto.
3. Calcula desvios em Q, ΔP_ar, ΔP_ref.
4. Resolve fatores: `capacityCorrectionFactor = Q_unilab / Q_calc`, idem para ΔPs, `heatTransferCorrectionFactor` ajusta U se vier do Unilab.
5. Re-roda com calibração, salva `deviation_after`.
6. Marca `meets_targets` segundo as metas (ver §6).

UI: na aba do componente, botão **"Calibrar contra Unilab"** mostra a tabela antes/depois e o status das metas.

---

## 4. Motor `physical_simple`

Novo arquivo `src/modules/coldpro/coil/physicalSimpleSimulator.ts`. Lógica:

```
1. Resolve A (área de troca):
   - Se Unilab forneceu surface_area_m2 → A = imported
   - Senão → A = derived.externalAreaM2 (estimated)

2. Resolve U (coeficiente global):
   - Se Unilab forneceu global_coeff_w e A → U = global_coeff_w / A (imported)
   - Senão → U estimado por faixa típica:
       evap DX ar: U ≈ 25–45 W/m²K (default 35)
       cond ar:    U ≈ 25–40 W/m²K (default 30)
     ajustado por airflowFactor^0.6 (estimated)

3. Calcula LMTD:
   - Evap fase única: ΔT_ml = ((Tar_in − Tref) − (Tar_out − Tref)) / ln(...)
     Quando Tar_out não fornecido, estima por balanço com airflow + cp_ar do banco.
   - Evap com mudança de fase: usa ΔH_ml / cp_ar (preparação para Fase 3 psicrometria).
   - Cond: análogo com Tref constante.

4. Q = U · A · LMTD · capacityCorrectionFactor · heatTransferCorrectionFactor

5. ΔP_ar e ΔP_ref:
   - Se Unilab forneceu → usa o valor importado * fator de calibração.
   - Senão → estimativa atual (já existente) * fator.

6. Saída inclui:
   { engine, U, A, LMTD, capacityW, sources: {U, A, dPair, dPref} }
```

Tipos atualizados:
```ts
type CoilEngine = "empirical" | "physical_simple" | "physical_advanced";
type FieldOrigin = "imported" | "calculated" | "calibrated" | "estimated" | "manual";

interface CoilSimulatorResult {
  // ... existentes
  engine: CoilEngine;
  U?: number;
  areaM2?: number;
  lmtdK?: number;
  fieldSources?: Record<string, FieldOrigin>;
}
```

`physicalAdvancedSimulator.ts` é criado **vazio** (stub) só para reservar o ponto de extensão.

---

## 5. Comparativo na tela Coil Simulator

Nova aba **"Comparativo"** ao lado de Resultados:

```
+----------------------+-----------+-----------+----------------+
|                      |  Unilab   | Empírico  | Physical Simple|
+----------------------+-----------+-----------+----------------+
| Capacidade (kW)      |   12.40   |   11.82   |     12.05      |
| Desvio %             |     —     |   −4.7%   |     −2.8%      |
| ΔP ar (Pa)           |   85      |   72      |     91         |
| Desvio %             |     —     |  −15.3%   |    +7.1%       |
| ΔP refrig. (kPa)     |   18      |   18*     |     21         |
| Desvio %             |     —     |    0%*    |    +16.7%      |
| U (W/m²K)            |   32.1    |     —     |     30.4       |
| Área (m²)            |   8.7     |     —     |     8.7        |
+----------------------+-----------+-----------+----------------+
* empírico copia ΔP do datasheet — não é cálculo independente
```

Linha "Status metas" indica em verde/vermelho se as 3 metas (§6) foram atendidas.

Toggle no header: **Motor: [ Empírico | Físico Simples | Comparar ambos ]** — modo "Comparar" calcula os dois e exibe a tabela.

---

## 6. Metas de aderência (após calibração)

Validadas no painel de calibração e na aba Comparativo:
- Capacidade: erro ≤ **5%**
- ΔP ar: erro ≤ **10%**
- ΔP refrigerante: erro ≤ **15%**

`meets_targets = true` apenas quando os três passam.

---

## 7. Rastreabilidade (origem de campo)

Toda saída do motor e toda linha do componente carrega `field_sources: Record<string, FieldOrigin>` com:
- `imported` — veio do PDF Unilab
- `calculated` — derivado por fórmula no front (ex.: área frontal)
- `calibrated` — corrigido pelo `coil_calibrations`
- `estimated` — chute por faixa típica (default)
- `manual` — usuário sobrescreveu

UI: cada campo numérico nos resultados mostra um pequeno **badge colorido** com a origem (já existe componente parecido em `unilab-import-form.tsx` — vamos reaproveitar).

---

## Entregáveis desta iteração

**Migration**
- `coil_materials`, `coil_fluids`, `coil_geometries`, `coil_calibrations` + RLS + seed.

**Módulos**
- `src/modules/coldpro/data/materials.ts`
- `src/modules/coldpro/data/fluids.ts`
- `src/modules/coldpro/data/geometries.ts`
- `src/modules/coldpro/coil/geometryDerived.ts`
- `src/modules/coldpro/coil/physicalSimpleSimulator.ts`
- `src/modules/coldpro/coil/physicalAdvancedSimulator.ts` (stub)
- `src/modules/coldpro/coil/calibration.ts` (`calibrateAgainstUnilab`, `applyCalibration`)
- Atualização de `coilSimulatorTypes.ts`: `CoilEngine`, `FieldOrigin`, novos campos no resultado.

**UI**
- Toggle de motor no Coil Simulator (Empírico / Físico Simples / Comparar).
- Nova aba **Comparativo** com tabela Unilab × Empírico × Physical Simple + status das metas.
- Badges de origem nos resultados.
- Botão **"Calibrar contra Unilab"** nas abas Evaporador e Condensador, abrindo dialog com a tabela antes/depois e salvando em `coil_calibrations`.
- (Opcional desta iteração) Aba admin **"Bancos"** com leitura de materiais/fluidos. CRUD completo pode ficar para uma próxima passada — para esta iteração basta seed + leitura.

**O que NÃO entra agora**
- Correlações avançadas (Wang, Cavallini, Kandlikar, Schmidt, Friedel) — ficam em `physical_advanced` (stub).
- Psicrometria ASHRAE completa — usamos cp_ar do banco e balanço simples.
- Modo Design — só depois do Verify físico calibrado bater as metas em pelo menos 3 datasheets reais.
- CRUD admin completo dos bancos.

---

## Detalhes técnicos (referência)

- Tudo TypeScript puro, Worker-safe, sem dependências nativas.
- `evaporator_coil_models.global_coeff_w` e `surface_area_m2` já existem — viram fonte primária de U e A.
- Calibração não modifica os modelos importados; vive em tabela separada e é aplicada **na hora do cálculo**.
- Histórico (`coil_simulations`) ganha `engine` e `calibration_id` para auditar qual motor/calibração gerou cada resultado.
- O motor empírico continua sendo o default até que exista calibração validada para o componente; quando houver, o default passa a ser `physical_simple` calibrado.

Confirma que posso seguir com esta iteração inteira (migration + módulos + UI comparativa + calibração) ou prefere quebrar em duas entregas (primeiro bancos+geometria derivada, depois motor+calibração+comparativo)?
