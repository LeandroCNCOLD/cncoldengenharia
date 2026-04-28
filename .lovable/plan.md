
# Consolidação da Fundação — CN Cold Engineering

A base atual já cobre a maior parte do briefing (navegação, schema, RBAC, status, dashboard, placeholders). Esta etapa **não recria nada** — apenas preenche as lacunas funcionais detectadas na revisão para deixar o sistema-base completo antes dos motores.

## Diagnóstico do que já está pronto

| Área | Estado atual |
|---|---|
| Navegação (Sidebar) | OK — Dashboard, Componentes, Uploads, Catálogo, Simulação, Relatórios, Administração |
| Simulação / Relatórios | OK — placeholders já isolados |
| Tabelas (`components`, `component_files`, `component_data`, `component_history`) | OK — todos os campos exigidos presentes |
| Tipos suportados (compressor, evaporador, condensador) | OK |
| Status (`incompleto`, `validando`, `pronto`, `inválido`) | OK — visível em listagem, detalhe, dashboard e catálogo |
| Bucket privado `component-files` | OK |
| Administração (papéis admin/engenheiro) | OK |
| Dashboard (KPIs, distribuição, recentes) | OK |

## Lacunas a corrigir nesta etapa

1. **Uploads não funcionais** — a página `/uploads` só lista; não há formulário de envio nem o detalhe do componente permite anexar arquivos.
2. **Sem validação de compatibilidade** entre tipo de arquivo e tipo de componente (regra: compressor → CSV; evaporador/condensador → PDF ou XLS).
3. **Sem remoção de arquivos** (briefing exige).
4. **Catálogo sem filtros** (tipo, status) nem **busca textual**.
5. **Listagem de Componentes sem filtros** por tipo/status.
6. **Recálculo de status** não dispara após upload/remoção (o status fica congelado em `incompleto`).
7. Pequenos polimentos: dashboard cita "Uploads recentes" sem link para o componente; detalhe do componente menciona que "upload será implementado na próxima iteração" — texto a substituir.

## Mudanças planejadas

### 1. Helper central de upload (`src/lib/uploads.ts`)
- `ALLOWED_KINDS_BY_TYPE`: mapa `compressor → ["csv"]`, `evaporador/condensador → ["pdf","xls"]`.
- `detectFileKind(fileName)`: deduz `csv | pdf | xls` pela extensão (`.csv`, `.pdf`, `.xls/.xlsx`).
- `uploadComponentFile({ componentId, componentType, file, userId })`:
  - valida extensão contra `ALLOWED_KINDS_BY_TYPE`;
  - faz `supabase.storage.from("component-files").upload(path, file)` em caminho `<componentId>/<timestamp>-<nome>`;
  - insere em `component_files` com `processing_status = "pendente"`;
  - registra `component_history` (`action: "file_uploaded"`);
  - chama `recomputeComponentStatus(componentId)`.
- `removeComponentFile(fileId)`:
  - apaga objeto do bucket;
  - apaga linha em `component_files`;
  - registra histórico (`file_removed`);
  - recalcula status.
- `recomputeComponentStatus(componentId)`: lê arquivos + `component_data.fields`, aplica `computeComponentStatus` (já existe em `src/lib/component-schema.ts`) e dá `update` em `components.status`.

### 2. Página Uploads (`src/routes/_app/uploads.tsx`)
- Adicionar bloco superior **"Enviar arquivo"**:
  - `Select` de componente (carrega lista) → quando escolhido, mostra os tipos de arquivo aceitos para aquele componente;
  - `Input type=file` com `accept` dinâmico;
  - botão "Enviar" usa o helper acima; toast de sucesso/erro.
- Tabela existente ganha coluna **"Ações"** com botão excluir (confirmação via `AlertDialog`).
- Mensagem vazia atualizada (sem "será habilitado").

### 3. Detalhe do componente (`src/routes/_app/components.$id.tsx`)
- Aba **Arquivos** ganha:
  - bloco de upload no topo (mesmo helper, já com `componentId`/`componentType` fixos);
  - cada item da lista: nome, tipo, data, status e botão remover;
  - aviso de tipos aceitos quando vazio (já existe — manter, retirar texto "próxima iteração").
- Após upload/remoção: invalidar queries `component-files`, `component`, `component-data`.

### 4. Catálogo (`src/routes/_app/catalog.tsx`)
- Barra de filtros acima do grid:
  - `Input` de busca (debounce simples; filtra por `name`, `manufacturer`, `fluid`);
  - `Select` "Tipo" (Todos / Compressor / Evaporador / Condensador);
  - `Select` "Status" (Todos / Incompleto / Validando / Pronto / Inválido).
- Filtragem feita client-side sobre o resultado da query.
- Estado vazio diferenciado quando filtros ativos.

### 5. Listagem de Componentes (`src/routes/_app/components.tsx`)
- Mesmos filtros (tipo, status, busca) aplicados sobre a tabela.
- Adicionar coluna "Atualizado em".

### 6. Dashboard (`src/routes/_app/dashboard.tsx`)
- "Uploads recentes" passa a linkar para `/components/$id` do arquivo.
- Atalho "Criar componente" já existe — manter.
- Acrescentar pequeno bloco "Componentes atualizados recentemente" ao lado de "Distribuição por tipo" (já está lá como "Componentes recentes" — apenas renomear o título para casar com o briefing).

### 7. Componente reutilizável `FileUploader`
- `src/components/file-uploader.tsx`: encapsula select de componente (opcional) + input de arquivo + botão. Reusado em `/uploads` e na aba Arquivos do componente.

## Diagrama de fluxo do upload

```text
[ usuário ] -> escolhe componente + arquivo
            -> detectFileKind()
            -> valida contra ALLOWED_KINDS_BY_TYPE[type]
              | inválido -> toast.error, aborta
              | válido   -> storage.upload() -> insert component_files
                         -> insert component_history
                         -> recomputeComponentStatus()
                         -> invalidate queries
```

## Itens explicitamente fora do escopo desta etapa

- Parsers reais de CSV / PDF / XLS (extração automática) — `processing_status` continua iniciando em `pendente`.
- Cálculo térmico, solver, comparação, simulação dinâmica, relatórios PDF, custos.
- Edição manual dos campos extraídos (já existe a estrutura JSON; a UI de edição vem na próxima fase de normalização).

## Resultado esperado

Plataforma-base 100% funcional para o ciclo: **criar componente → enviar arquivos → ver status atualizar → consultar pelo catálogo com filtros → administrar usuários** — pronta para receber os módulos de parsing e os motores térmicos sem refatoração estrutural.
