# Catalog Consolidation Report

## Status

Implementacao pronta; consolidacao real pendente porque os arquivos de origem CN Cold nao estao presentes no workspace.

## Engine implementado

- `mergeCnCatalogs()`
- `generateModelFingerprint()`
- `validateCatalogImport()`

## Prioridade de fontes

1. `official`
2. `480`
3. `csv`

## Fingerprint

Composicao:

- modelo
- hp
- evaporador
- condensador

Smoke test sintetico:

- entrada: `Modelo=CN 1000 LT`, `HP=1.0`, `Evaporador=EVP-01`, `Condensador=COND-01`
- fingerprint: `CN 1000 LT|1.0|EVP-01|COND-01`

## Preservacao de conflitos

Conflitos entre fontes sao preservados em `raw_sources_json`, junto com todas as linhas raw usadas na consolidacao.

## Tabelas master criadas

- `cn_equipment_master`
- `cn_equipment_evaporator_master`
- `cn_equipment_condenser_master`
- `cn_equipment_compressor_master`
- `cn_equipment_performance_master`

## Pendencias para consolidacao real

1. Disponibilizar os 3 arquivos de origem no workspace ou via Storage.
2. Executar `importCnCatalog()` para cada arquivo.
3. Executar `mergeCnCatalogs()`.
4. Executar `validateCatalogImport()`.
5. Atualizar este relatorio com:
   - modelos unicos
   - duplicados
   - conflitos
   - divergencias entre fontes
   - confiabilidade final dos dados
