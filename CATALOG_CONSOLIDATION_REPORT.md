# Catalog Consolidation Report

## Status

Consolidacao real executada com a fonte `480`.

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
- Curva em `cn_equipment_performance_master`: sim

Evaporador estruturado:

- `geometry`: `27 x 31,5`
- `tube_diameter`: 12,7 mm
- `tube_thickness`: 0,5 mm
- `rows`: 4
- `tubes_per_row`: 24
- `circuits`: 12
- `fin_spacing`: 7 mm
- `airflow`: 12950 m3/h

Condensador estruturado:

- `geometry`: `22 x 25,4`
- `tube_diameter`: 9,525 mm
- `tube_thickness`: 0,3 mm
- `rows`: 6
- `tubes_per_row`: 24
- `circuits`: 12
- `fin_spacing`: 2,1 mm
- `airflow`: 8505 m3/h

Performance:

- `tevap`: -23 C
- `tcond`: 53,8 C
- `capacity_evap`: 14950,365 W
- `capacity_cond`: 28353,94 W
- `power`: 16,14 kW
- `cop`: 1,137570351491983

## Preservacao de conflitos

Conflitos entre fontes sao preservados em `raw_sources_json`, junto com todas as linhas raw usadas na consolidacao.

## Tabelas master criadas

- `cn_equipment_master`
- `cn_equipment_evaporator_master`
- `cn_equipment_condenser_master`
- `cn_equipment_compressor_master`
- `cn_equipment_performance_master`

## Pendencias de consolidacao

1. Mapear volume interno e area de troca quando a planilha trouxer valores preenchidos.
2. Reclassificar colunas de auditoria que agora estao mapeadas pelo helper de aliases.
3. Reexecutar futuramente com fontes `official` e `csv` para detectar divergencias reais entre fontes.
