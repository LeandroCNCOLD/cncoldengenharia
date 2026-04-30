# Official CN Catalog Import Report

## Status

Importacao real nao executada nesta iteracao: os arquivos abaixo nao existem no workspace atual.

- `CATÁLOGO OFICIAL 60Hz 2027–2029` (Excel)
- `catalogo_480_modelos_codigo_completo_corrigido.xlsx`
- `catalogo-coldpro-2026-04-30.csv`

## Implementado

- Tabelas raw/auditoria/master via migracao `20260430135700_cn_catalog_ingestion.sql`.
- `importCnCatalog(file, source_type)` em `src/lib/coldpro/cn-catalog-ingestion.ts`.
- Leitura de todas as abas de Excel e todas as linhas/colunas detectadas.
- Preservacao integral da linha em `raw_json`.
- Auditoria automatica de colunas em `cn_catalog_columns_audit`.
- Colunas desconhecidas marcadas como nao mapeadas, sem descarte.

## Smoke test local

Fixture sintetico:

- Total linhas: 1
- Total colunas: 5
- Coluna desconhecida preservada: `Coluna Desconhecida X`
- Fingerprint gerado: `CN 1000 LT|1.0|EVP-01|COND-01`

## Pendencias para importacao oficial

1. Disponibilizar os tres arquivos de origem no workspace ou via upload/storage.
2. Executar `importCnCatalog` para cada arquivo.
3. Executar `mergeCnCatalogs`.
4. Executar `validateCatalogImport`.
5. Regenerar este relatorio com contagens reais.
