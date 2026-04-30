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

## Consolidacao executada - fonte 480

- Arquivo consolidado: `catalogo_480_modelos_codigo_completo_corrigido.xlsx`
- `mergeCnCatalogs()` executado.
- Modelos unicos: 481
- Grupos duplicados: 216
- Conflitos entre fontes: 0
- Fontes usadas nesta etapa: apenas `480`

## Validacao de modelo real

Modelo validado: `CN_1200_LT_COPELAND_ZF41K5E_380V_3F_60HZ`

- Refrigerante definido: sim (`R404A`)
- Evaporador no master: sim
- Condensador no master: sim
- Compressor sugerido no master: sim
- Curva em `cn_equipment_performance_master`: nao
- Observacao: dados detalhados de evaporador/condensador foram preservados em `raw_json`, mas o mapeamento atual ainda nao extraiu todos os campos geometricos para colunas estruturadas (`tube_diameter`, `rows`, `airflow`, etc.).

## Preservacao de conflitos

Conflitos entre fontes sao preservados em `raw_sources_json`, junto com todas as linhas raw usadas na consolidacao.

## Tabelas master criadas

- `cn_equipment_master`
- `cn_equipment_evaporator_master`
- `cn_equipment_condenser_master`
- `cn_equipment_compressor_master`
- `cn_equipment_performance_master`

## Pendencias de consolidacao

1. Mapear colunas geometricas da planilha 480 para preencher colunas estruturadas dos masters.
2. Popular `cn_equipment_performance_master` a partir das colunas de capacidade, calor rejeitado, potencia, COP e temperaturas.
3. Reexecutar futuramente com fontes `official` e `csv` para detectar divergencias reais entre fontes.
