# Plano de reset controlado da base ColdPro

## Objetivo

Zerar dados importados e operacionais do ColdPro para permitir uma reimportacao limpa dos catalogos, preservando:

- schema;
- migrations;
- funcoes;
- triggers;
- RLS policies;
- usuarios de autenticacao;
- `profiles`;
- `user_roles`;
- permissoes/roles.

Este plano **nao executa o reset automaticamente**. Os scripts SQL foram criados para revisao e execucao manual.

## Arquivos criados

- `scripts/coldpro-reset/backup_before_reset.sql`
- `scripts/coldpro-reset/reset_imported_data.sql`
- `scripts/coldpro-reset/verify_reset.sql`

## Ordem correta de execucao

1. Abrir uma transacao/sessao controlada no SQL editor ou `psql`.
2. Executar `scripts/coldpro-reset/backup_before_reset.sql`.
3. Conferir se as tabelas `backup_*` foram criadas e contêm registros.
4. Executar `scripts/coldpro-reset/reset_imported_data.sql`.
5. Executar `scripts/coldpro-reset/verify_reset.sql`.
6. Conferir se as tabelas importadas/operacionais retornam `0`.
7. Iniciar a reimportacao dos catalogos novos.

## Tabelas com backup logico

O script de backup cria/recria snapshots em tabelas:

- `backup_technical_components`
- `backup_technical_mapped_records`
- `backup_cn_catalog_performance_curves`
- `backup_equipment_projects`
- `backup_component_items`
- `backup_equipment_component_links`
- `backup_evaporator_coil_models`
- `backup_condenser_coil_models`
- `backup_coil_simulations`
- `backup_coil_calibrations`

Cada backup usa `CREATE TABLE backup_* AS TABLE ... WITH DATA`.

## Tabelas que serao limpas

O reset trunca, se existirem:

- `cn_catalog_component_suggestions`
- `cn_product_development`
- `cn_catalog_performance_curves`
- `technical_mapped_records`
- `technical_raw_records`
- `technical_import_batches`
- `technical_components`
- `equipment_component_links`
- `component_items`
- `equipment_simulations`
- `equipment_projects`
- `evaporator_coil_models`
- `condenser_coil_models`
- `coil_simulations`
- `coil_calibrations`
- `coil_performance_maps`
- `compressor_polynomials`
- `compressor_models`
- `fan_curves`
- `fan_models`
- `refrigerant_polynomials`
- `refrigerants`
- `coil_fluids`
- `coil_materials`
- `coil_correlations`
- `coil_geometry_factors`
- `unilab_geometries_factors`
- `unilab_geometries`
- `unilab_raw_tables`
- `unilab_source_rows`
- `unilab_source_files`
- `unilab_import_batches`
- `unilab_import_batches_v2`
- `unilab_extractions`
- `coil_factor_application_logs`

O script usa `TRUNCATE ... RESTART IDENTITY CASCADE`.

## Tabelas preservadas

Nao apagar:

- `profiles`
- `user_roles`
- usuarios em `auth.users`
- tabelas de migrations
- funcoes
- policies RLS
- roles/permissoes
- schema do banco

## Riscos

1. `TRUNCATE ... CASCADE` remove dados dependentes das tabelas listadas.
2. Backups `backup_*` sao tabelas comuns no mesmo schema; se o schema for resetado depois, elas tambem podem ser perdidas.
3. Dados criados entre backup e reset nao entram no backup se houver uso simultaneo da aplicacao.
4. Se as migrations dos novos catalogos ainda nao tiverem sido aplicadas, algumas tabelas da lista podem nao existir; os scripts ignoram tabelas ausentes via `to_regclass`.
5. Restaurar dados antigos pode reintroduzir inconsistencias que motivaram o reset.

## Plano de rollback

Rollback manual basico, por tabela:

```sql
BEGIN;

TRUNCATE TABLE public.technical_components RESTART IDENTITY CASCADE;
INSERT INTO public.technical_components SELECT * FROM public.backup_technical_components;

-- Repetir para as demais tabelas que precisarem ser restauradas.

COMMIT;
```

Ordem recomendada para restaurar:

1. tabelas base/import batches;
2. raw/mapped/technical components;
3. `equipment_projects`;
4. `component_items`;
5. coil models;
6. links;
7. simulacoes/calibracoes/mapas.

Para rollback completo, revisar dependencias e executar dentro de transacao.

## Comandos sugeridos

Via `psql`:

```bash
psql "$DATABASE_URL" -f scripts/coldpro-reset/backup_before_reset.sql
psql "$DATABASE_URL" -f scripts/coldpro-reset/reset_imported_data.sql
psql "$DATABASE_URL" -f scripts/coldpro-reset/verify_reset.sql
```

Via Supabase SQL editor:

1. colar e executar `backup_before_reset.sql`;
2. validar backups;
3. colar e executar `reset_imported_data.sql`;
4. colar e executar `verify_reset.sql`.

## Criterio de sucesso

- backups criados antes do reset;
- tabelas importadas/operacionais zeradas;
- `profiles`, `user_roles`, `auth.users`, schema, funcoes e RLS preservados;
- ambiente pronto para reimportar os catalogos CN/Unilab corretamente.
