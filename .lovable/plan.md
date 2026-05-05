## Objetivo
Adicionar botão "Novo Aletado" na barra superior (ProjectHeaderBar) e na sidebar de Configurar (WorkspaceSidebar), conectando handlers que limpam o workspace nos dois pages (Evaporador e Condensador).

## Mudanças

### 1. `src/modules/cn_coils/components/ProjectHeaderBar.tsx`
- Adicionar prop opcional `onNovoAletado?: () => void` na interface.
- Desestruturar a prop na assinatura da função.
- Renderizar botão "Novo Aletado" (verde, ícone `Plus`) antes do botão "Catálogo" nos dois ramos do JSX (com e sem projeto ativo, ~linhas 204 e 233), exibido apenas quando `onNovoAletado` for fornecido.

### 2. `src/modules/cn_coils/pages/EvaporatorUnifiedWorkspacePage.tsx`
- `useProjectStore` já importado (linha 70). Reaproveitar `setActiveProject` via selector.
- Adicionar `const reset = useCnCoilsSimulationStore((s) => s.reset)` se ainda não existir.
- Criar `handleNovoAletado` que faz `reset()`, `setActiveProject(null)` e `toast.success(...)`.
- Passar `onNovoAletado={handleNovoAletado}` para `<ProjectHeaderBar>` (linha ~755).

### 3. `src/modules/cn_coils/pages/CondenserWorkspacePage.tsx`
- Importar `useProjectStore`.
- Mesma lógica do Evaporador: selector de `setActiveProject`, selector de `reset`, `handleNovoAletado`, e prop no `<ProjectHeaderBar>` (linha ~725).

### 4. `src/modules/cn_coils/components/WorkspaceSidebar.tsx`
- Importar `GeometryEditorModal`.
- Adicionar estado local `geomEditorOpen`.
- Adicionar item extra `<li>` "+ Novo Aletado…" depois do `MODAL_BUTTONS.map(...)` na seção Configurar.
- Renderizar `<GeometryEditorModal open={geomEditorOpen} mode="create" baseGeometry={null} onClose={...} onSaved={...} />` antes do fechamento do `</aside>`.

## Garantias
- Sem alterações em lógica de cálculo, tipos, hooks ou outros componentes.
- Apenas chamadas existentes de `reset` e `setActiveProject` são reutilizadas.
