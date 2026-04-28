## Contexto

A base atual já tem:
- Catálogo de componentes (compressor, evaporador, condensador) com normalização, conflitos e prontidão.
- Página `/simulation` que lista componentes Prontos × Bloqueados, mas **sem motor de cálculo**.
- Schema com `coeficientes` (AHRI 540) e `faixa_operacional` no compressor; capacidade nominal e temperaturas de referência em evaporador/condensador.

O prompt v4.0 cobre 4 grandes funcionalidades + arquitetura ampla. Em vez de tentar tudo de uma vez (alto risco), proponho uma **Fase 1 enxuta**: motor de equilíbrio + sistemas + simulação básica funcionando ponta a ponta, deixando linhas de sucção, custos, dinâmica e comparação para fases seguintes (já estruturadas, mas não implementadas).

## Escopo desta etapa (Fase 1 — Motor de Equilíbrio + Sistemas)

### 1. Banco de dados
Nova migração com 3 tabelas (RLS habilitado, política `authenticated`):

- **`systems`** — combinação nomeada de 1 compressor + 1 evaporador + 1 condensador
  - `id, name, description, compressor_id, evaporator_id, condenser_id, created_by, created_at, updated_at`
  - FK referenciando `components(id)` com `ON DELETE RESTRICT`
  - Trigger valida que cada FK aponta para um componente do tipo correto
- **`simulations`** — uma execução de cálculo
  - `id, system_id, t_evap_target, t_air_evap, t_air_cond,`
  - `t_cond_eq, q_evap, q_comp, w_comp, q_cond, cop, balance_error,`
  - `util_comp, util_evap, util_cond, bottleneck,`
  - `recommendations jsonb, raw jsonb, created_by, created_at`
- Sem tabelas para sucção/custos/dinâmica/comparação ainda — entram nas fases seguintes.

Índices: `systems(created_by)`, `simulations(system_id, created_at desc)`.

### 2. Motor de cálculo (TypeScript puro, client-side)

`src/lib/engine/` (sem Python, sem servidor extra — roda no browser via TanStack Query):

- **`ahri540.ts`** — avalia polinômio AHRI 540 de 10 coeficientes para capacidade e potência do compressor em função de `(T_evap, T_cond)`. Aceita `coeficientes` no formato `{ capacity: number[10], power: number[10] }` armazenado no `component_data.fields`.
- **`heat-exchanger.ts`** — modelo simplificado linear para evaporador/condensador:
  - `Q_evap = UA_evap × (T_air_evap − T_evap)` derivado da capacidade nominal e ΔT de referência.
  - `Q_cond = UA_cond × (T_cond − T_air_cond)` análogo.
- **`equilibrium.ts`** — busca `T_cond` no intervalo (T_air_cond+1 … 70 °C) que minimize `|Q_cond − (Q_evap + W_comp)|` (passo 0,1 °C, depois refino bisection). Retorna ponto de equilíbrio + utilizações + gargalo.
- **`recommendations.ts`** — gera lista de sugestões com base em utilizações (>90% / <50%) e erro de balanço.

Validações de entrada: `T_air_evap > T_evap_target`, `T_air_cond < 60`, componentes prontos (`status='pronto'`).

### 3. Interface (novas rotas TanStack)

- **`/systems`** (`src/routes/_app/systems.tsx`) — lista de sistemas montados, botão "Novo sistema".
- **`/systems/new`** — formulário: nome + 3 selects (filtrados por tipo e `status='pronto'`).
- **`/systems/$id`** — detalhe do sistema, lista de simulações anteriores, botão "Nova simulação".
- **`/systems/$id/simulate`** — formulário com 3 sliders/inputs (`T_evap_target`, `T_air_evap`, `T_air_cond`) e resultado:
  - Cards de destaque: T_cond, COP, Q_evap, W_comp.
  - Tabela de utilizações e gargalo.
  - Lista de recomendações com prioridade.
  - Botão "Salvar simulação" → grava em `simulations`.
- **`/simulation`** (existente) — passa a mostrar Sistemas Prontos como atalho para simular, mantendo a lista de Componentes Prontos × Bloqueados como abaixo.

Sidebar ganha item **"Sistemas"** entre "Catálogo Técnico" e "Simulação".

### 4. Fora desta etapa (próximos prompts)

Mantidos no roadmap mas **não implementados agora**, para evitar plano gigante e decisões prematuras:

- Linhas de sucção (precisa tabela de tubos comerciais e fluido configurável — só R-404A não é suficiente).
- Análise de custos / payback / VPL (precisa inputs de tarifa, horas, investimento por componente — confirmar fonte).
- Simulação dinâmica (perfil senoidal de T_ar — confirmar se 24 h ou 7 dias é o padrão).
- Comparação de sistemas (depende de pesos configuráveis pelo usuário).
- Exportação PDF, gráficos Chart.js, modo escuro extra.

Cada um desses vira um prompt focado depois que o motor base estiver validado.

## Detalhes técnicos

- **Sem Python, sem FastAPI, sem novo backend.** O motor é TypeScript puro chamado direto na página de simulação; persistência via Supabase como já é feito.
- **Coeficientes AHRI 540**: o schema já reserva `coeficientes` como JSON. Vou padronizar como `{ capacity: number[10], power: number[10] }` e documentar isso no `FieldEditor` via placeholder/help text.
- **Faixa operacional**: `{ t_evap_min, t_evap_max, t_cond_min, t_cond_max }`. O motor rejeita pontos fora.
- **RLS**: `systems` e `simulations` seguem o mesmo padrão das tabelas existentes (`authenticated` pode CRUD; `created_by = auth.uid()` no INSERT).
- **Tipos gerados**: após a migração, `src/integrations/supabase/types.ts` é regenerado automaticamente.

## Entregáveis

1. Migração SQL (`systems`, `simulations`, RLS, trigger de validação de tipo).
2. Motor `src/lib/engine/` (4 arquivos).
3. 4 novas rotas (`/systems`, `/systems/new`, `/systems/$id`, `/systems/$id/simulate`).
4. Atualização da sidebar e da página `/simulation` (atalho para sistemas).
5. Atualização do `.lovable/plan.md` registrando a Fase 1 do motor.

Após sua aprovação, executo tudo em sequência. Os módulos seguintes (sucção, custos, dinâmica, comparação) serão propostos um a um nos próximos prompts.