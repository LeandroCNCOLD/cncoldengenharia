# Estabilidade do processamento catalogo 480 - length_mm

## Onde estava o problema

- O erro `Faltam: length_mm` vinha da validacao tecnica de trocadores.
- O mapper 480 extraia geometria, tubos, filas, circuitos e passo, mas nao persistia `length_mm` nos masters.
- O problema afetava evaporador e condensador; reaquecimento deve seguir a mesma regra apenas quando existir.
- Ao reprocessar, o banco remoto ainda nao tinha colunas `length_mm` em `cn_equipment_evaporator_master` e `cn_equipment_condenser_master`.

## O que foi corrigido

- Criada funcao global `parseLengthMm(raw)`.
- A funcao tenta primeiro aliases diretos:
  - `length_mm`
  - `comprimento_mm`
  - `comprimento`
  - `length`
  - `comprimento_aletado`
  - `comprimento_trocador`
  - `evap_length_mm`
  - `cond_length_mm`
  - `reheat_length_mm`
- Se nao houver valor direto, extrai o maior valor `> 300` em descricoes como:
  - `27 x 31,5 - ESPAÇAMENTO 7,00 mm - 1880 mm`
  - `5 x 32 - ESPAÇAMENTO 2,10 mm - 1200 mm`
- Aplicado no mapper:
  - evaporador: `length_mm = parseLengthFromAliases(chosen, ALIASES.evapLength)`
  - condensador: `length_mm = parseLengthFromAliases(chosen, ALIASES.condLength)`
- Adicionada migration `20260430185200_cn_catalog_coil_length.sql` para incluir:
  - `cn_equipment_evaporator_master.length_mm`
  - `cn_equipment_condenser_master.length_mm`
  - `cn_equipment_reheat_master.length_mm` quando a tabela existir
- Readiness agora separa mensagens:
  - `Evaporador incompleto: Faltam: length_mm`
  - `Condensador incompleto: Faltam: length_mm`

## Testes executados

- `parseLengthMm({ description: "27 x 31,5 - ESPAÇAMENTO 7,00 mm - 1880 mm" }) = 1880`
- `parseLengthMm({ description: "5 x 32 - ESPAÇAMENTO 2,10 mm - 1200 mm" }) = 1200`
- `npx tsc --noEmit`
- `npx eslint src/lib/coldpro/cn-catalog-ingestion.ts src/lib/coldpro/equipment-readiness.ts`
- `npm run build`

## Como executar com seguranca

1. Aplicar migration:

```sql
-- supabase/migrations/20260430185200_cn_catalog_coil_length.sql
ALTER TABLE public.cn_equipment_evaporator_master
  ADD COLUMN IF NOT EXISTS length_mm numeric;

ALTER TABLE public.cn_equipment_condenser_master
  ADD COLUMN IF NOT EXISTS length_mm numeric;
```

2. Reprocessar somente masters a partir do RAW ja importado:

```ts
await mergeCnCatalogs();
await validateCatalogImport();
```

3. Nao reimportar raw e nao limpar batches.

## Comandos recomendados

```bash
npx tsc --noEmit
npx eslint src/lib/coldpro/cn-catalog-ingestion.ts src/lib/coldpro/equipment-readiness.ts
npm run build
```

## Observacao

O reprocessamento remoto de `length_mm` depende da migration `20260430185200_cn_catalog_coil_length.sql` estar aplicada no banco.
