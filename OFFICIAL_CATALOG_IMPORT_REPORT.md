# Official CN Catalog Import Report

## Status

Importacao real executada somente para:

- `catalogo_480_modelos_codigo_completo_corrigido.xlsx`
- `source_type = 480`

Arquivos `official` e `csv` nao foram usados nesta etapa.

## Implementado

- Tabelas raw/auditoria/master via migracao `20260430135700_cn_catalog_ingestion.sql`.
- `importCnCatalog(file, source_type)` em `src/lib/coldpro/cn-catalog-ingestion.ts`.
- Leitura de todas as abas de Excel e todas as linhas/colunas detectadas.
- Preservacao integral da linha em `raw_json`.
- Auditoria automatica de colunas em `cn_catalog_columns_audit`.
- Colunas desconhecidas marcadas como nao mapeadas, sem descarte.

## Resultado da importacao 480

- Arquivo localizado em `coldpro-imports/catalogo_480_modelos_codigo_completo_corrigido.xlsx`
- Download via storage: OK
- Batches criados: 3
- Linhas importadas em RAW: 704
- Colunas auditadas: 212
- Erros de parsing/importacao: 0
- Colunas nao mapeadas: 94

## Amostra de colunas nao mapeadas

- `FABRICANTE`
- `FABRICANTE_ORIGEM`
- `CONFIGURACAO_ELETRICA`
- `TENSÃO ELÉTRICA [v]`
- `TENSAO_V`
- `NUMERO_FASES`
- `FREQUENCIA_HZ`
- `LINHA`
- `GABINETE`
- `TIPO DE GABINETE`
- `GWP-AR6`
- `ODP-AR6`
- `TIPO DE DEGELO`
- `TEMPERATURA DA CÂMARA (°C)`
- `TEMPERATURA EXTERNA  (°C)`

## Observacoes

- Todas as linhas foram persistidas em `cn_catalog_raw_rows.raw_json`.
- As colunas nao mapeadas foram preservadas no RAW e registradas em `cn_catalog_columns_audit`.
- O mapeamento da planilha 480 foi ajustado e os masters foram reprocessados sem novo upload.
- `cn_equipment_performance_master` possui 474 pontos apos o reprocessamento.
