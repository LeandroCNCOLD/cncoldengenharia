# Importacao COMPRESSORES_SW_COMPLETO

## Status

Infraestrutura criada, importacao real bloqueada porque a pasta `COMPRESSORES_SW_COMPLETO`
nao existe no workspace atual.

## Entregue

- Migration `20260430144100_compressor_sw_multi_manufacturer.sql`.
- Tabelas:
  - `compressor_import_batches`
  - `compressor_import_audit`
  - `compressor_refrigerants`
  - `compressor_envelopes`
  - `compressor_oils`
- Extensoes em tabelas existentes:
  - `compressor_models`: `series`, `motor_type`, `application_range`, `source_file`
  - `compressor_polynomials`: `manufacturer`, `model`, `refrigerant`, `source_file`
- Importador `src/lib/coldpro/compressor-sw-importer.ts`.

## Regras implementadas

- Fabricante nao e fixo.
- Deteccao por coluna (`manufacturer`, `brand`, `make`), arquivo/pasta e prefixo/modelo.
- RAW preservado em `raw_json`.
- Batch em `compressor_import_batches`.
- Auditoria por arquivo em `compressor_import_audit`.
- Deduplicacao de polinomios por `manufacturer + model + refrigerant + curve_type`.
- Dados tecnicos estruturados sao importados antes de qualquer promocao para `technical_components`.
- Funcao `promoteValidatedCompressorsToTechnicalComponents()` cria componentes como `compressor`, `context = reference`, `status = needs_review` ou `validated`.

## Smoke test

Fixture sintetico:

- Copeland `ZR42K3`
- Bitzer `4DES-7Y`
- Danfoss detectado por nome de arquivo

Resultado:

- `Copeland` detectado por coluna `Brand`.
- `Bitzer` detectado por coluna `Manufacturer`.
- `Danfoss` detectado por nome de arquivo/pasta.

## Pendente

1. Disponibilizar a pasta real `COMPRESSORES_SW_COMPLETO` no workspace ou storage.
2. Executar `importCompressorSwFolder()` com todos os arquivos da pasta.
3. Conferir `compressor_import_audit` para arquivos com erros ou linhas ignoradas.
4. Promover apenas registros validados para `technical_components`.
