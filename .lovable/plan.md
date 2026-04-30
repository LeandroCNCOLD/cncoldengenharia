# Desenvolvimento de Produtos — Kanban CN

Nova área no menu lateral para gerenciar o ciclo de vida dos produtos do catálogo CN COLD: desde a importação inicial até virarem equipamento publicado pronto para uso (ou serem arquivados).

## Fluxo de status

```text
A Analisar  →  Em Análise  →  Sugestões OK  →  Aprovado ──► vira equipment_project (catálogo de produção)
                                                  │
                                                  └──► Arquivado (descarte / incompatível)
```

- **Aprovado** = produto publicado no catálogo de produção (cria/vincula `equipment_projects` com status `published`). Disponível para uso real em projetos e simulações.
- **Arquivado** = caminho separado, só para descartes. Não é "fim do fluxo aprovado".
- Filtro padrão do Kanban esconde "Arquivado" (toggle "Mostrar arquivados" no header).

## Estrutura

### 1. Sidebar
Adicionar item **"Desenvolvimento"** (ícone Kanban) em `src/components/app-sidebar.tsx`, apontando para `/coldpro/desenvolvimento`. Visível para todos (não admin-only).

### 2. Nova rota
`src/routes/_app/coldpro/desenvolvimento.tsx`
- Header com: título, botão **"Importar Catálogo CN COLD"** (reutiliza `CatalogUploadButton`), botão **"+ Novo Produto"**, toggle "Mostrar arquivados", busca por modelo.
- Board Kanban em 5 colunas com drag-and-drop.

### 3. Tabela nova: `cn_product_development`
```sql
- id uuid pk
- catalog_model text (modelo CN, ex: "MCC 250")
- linha text, hp text, refrigerante text   -- denormalizado pra card
- status text check in ('a_analisar','em_analise','sugestoes_ok','aprovado','arquivado')
- position int                              -- ordem dentro da coluna
- equipment_project_id uuid                 -- preenchido quando aprovado
- notes text
- archived_reason text
- approved_at timestamptz
- archived_at timestamptz
- created_by uuid, created_at, updated_at
- unique(catalog_model)
```
RLS: select/insert/update authenticated; delete admin.

**Backfill**: popular automaticamente com modelos distintos de `cn_catalog_performance_curves` que ainda não existem na tabela (status inicial `a_analisar`).

**Trigger**: ao inserir nova curva no catálogo, criar registro em `cn_product_development` se modelo novo.

### 4. Componentes

- `src/components/coldpro/product-kanban-board.tsx` — colunas + dnd-kit
- `src/components/coldpro/product-kanban-card.tsx` — card com modelo, linha, HP, refrigerante, badge de tier de sugestão, contador de curvas
- `src/components/coldpro/product-detail-drawer.tsx` — abre ao clicar no card: mostra curvas reais, botão "Gerar sugestões CN", lista de componentes aceitos, botão "Aprovar e publicar"
- `src/components/coldpro/new-product-dialog.tsx` — formulário manual (modelo, linha, HP, refrigerante, notas)

### 5. Server functions
`src/server/cnProductDevelopment.functions.ts`:
- `listProducts({ includeArchived })`
- `updateProductStatus({ id, status, position })` — usado pelo drag-and-drop
- `reorderProducts({ status, orderedIds })`
- `createProduct(input)` — manual
- `approveProduct({ id })` — cria/atualiza `equipment_projects` (status `published`), grava `equipment_project_id` e `approved_at`, move card pra coluna Aprovado
- `archiveProduct({ id, reason })`
- `unarchiveProduct({ id })`

### 6. Aprovação → catálogo de produção
`approveProduct` cria um `equipment_projects` com:
- `code` = modelo CN
- `commercial_name` = modelo CN
- `refrigerant`, `family` herdados das curvas
- `status` = `published`
- vincula component_items que já foram aceitos via `cn_catalog_component_suggestions`

A coluna "Aprovado" mostra link direto pro equipamento publicado (`/coldpro/equipamentos/$id`).

### 7. Limpeza
- Remover ou simplificar o `CatalogCnColdCard` da página `banco-tecnico` (mover botão de import pra nova área é o canal principal; deixar card lá só como atalho informativo).

## Dependências
- `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` (drag-and-drop)

## Detalhes técnicos

- Drag-and-drop persiste otimisticamente (atualiza UI antes da resposta do servidor; rollback em erro).
- `position` recalculada por coluna (passos de 1000 pra evitar reordenação completa frequente).
- Cache react-query invalidado em mutations.
- Colunas com altura fixa + scroll interno; cabeçalho do board sticky.
- Dark mode via tokens semânticos existentes.

## Arquivos
- novo: `src/routes/_app/coldpro/desenvolvimento.tsx`
- novo: `src/components/coldpro/product-kanban-board.tsx`
- novo: `src/components/coldpro/product-kanban-card.tsx`
- novo: `src/components/coldpro/product-detail-drawer.tsx`
- novo: `src/components/coldpro/new-product-dialog.tsx`
- novo: `src/server/cnProductDevelopment.functions.ts`
- novo: `src/lib/coldpro/product-development.ts` (queries client-side)
- nova migration: tabela + trigger + backfill
- editado: `src/components/app-sidebar.tsx`
- editado: `src/routes/_app/coldpro/admin.banco-tecnico.tsx` (atalho informativo)
