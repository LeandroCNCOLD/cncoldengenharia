# CN Cold Engineering — Fundação da plataforma

Plataforma interna modular de engenharia e pré-vendas técnica. Esta entrega cria a base estrutural completa: gestão de componentes, ingestão de arquivos, dados extraídos, validação por status e catálogo técnico — pronta para receber motores térmicos no futuro sem refatoração.

## Identidade visual

Alinhada à marca CN Cold (referência: cncold.com.br):

- **Paleta:** azul profundo `#0a2540` (sidebar), azul royal `#1e5bd8` (ações primárias), azul claro `#3da9fc` (acentos), cinza `#f5f7fa` (fundo de conteúdo), branco para cards.
- **Tipografia:** Sora (títulos) + Inter (corpo).
- **Layout:** SaaS interno — sidebar escura à esquerda com logo oficial CN Cold, conteúdo claro à direita, cards limpos, badges coloridos por status. Sem efeitos desnecessários.

## Navegação principal (sidebar)

1. **Dashboard** — KPIs e visão operacional.
2. **Componentes** — lista, criação, detalhe e edição.
3. **Uploads** — fila global de arquivos com status de processamento.
4. **Catálogo Técnico** — vitrine de consulta com filtros.
5. **Simulação** — placeholder ("Disponível na próxima etapa").
6. **Relatórios** — placeholder.
7. **Administração Técnica** — usuários, papéis, configurações (admin).

## Autenticação e papéis

- Login email/senha + Google (Lovable Cloud), com tela de login com identidade CN Cold.
- Papéis em tabela dedicada `user_roles` (sem privilege escalation):
  - **admin** — acesso total, inclui Administração Técnica.
  - **engenheiro** — Dashboard, Componentes, Uploads, Catálogo. Vê placeholders de Simulação/Relatórios.
- Rotas protegidas por layout `_authenticated` e `_admin` aninhado.

## Modelo de dados

- **profiles** — dados do usuário (id, nome, email).
- **user_roles** — papéis (admin | engenheiro), com função `has_role()` security definer.
- **components** — id, nome técnico, tipo (`compressor` | `evaporador` | `condensador`), fabricante, fluido, status (`incompleto` | `validando` | `pronto` | `inválido`), criado_por, criado_em, atualizado_em.
- **component_files** — id, component_id, nome, tipo (CSV/PDF/XLS), caminho no storage, tamanho, status de processamento (`pendente` | `processando` | `processado` | `erro`), mensagem de erro, enviado_por, enviado_em.
- **component_data** — JSONB estruturado por tipo (campos esperados conforme spec), com marca por campo de origem (`arquivo` | `manual`).
- **component_history** — auditoria: ação, usuário, timestamp, payload.
- **Storage bucket** `component-files` (privado) com RLS por componente.
- RLS em todas as tabelas: usuários autenticados leem/escrevem componentes e arquivos; admins gerenciam usuários e papéis.

## Gestão de componentes

- **Lista** (`/components`): tabela com nome, tipo, fabricante, fluido, status (badge), nº de arquivos, atualizado em. Filtros por tipo e status, busca textual, ordenação.
- **Criar** (`/components/new`): formulário com tipo (define schema de dados e arquivos esperados), nome, fabricante, fluido. Nasce com status `incompleto`.
- **Detalhe** (`/components/$id`) com abas:
  - *Visão geral* — metadados + status + checklist de prontidão (campos preenchidos vs. ausentes, arquivos esperados vs. enviados).
  - *Arquivos* — drag & drop, lista com nome/tipo/status/data, ações (download, reprocessar, remover). Validação de tipo de arquivo conforme tipo de componente.
  - *Dados extraídos* — formulário dinâmico por tipo (compressor: modelo, fabricante, fluido, coeficientes, faixa operacional, observações; evaporador/condensador: descrição, capacidade nominal, fluido, temperaturas, vazão de ar, geometria mínima, queda de pressão, observações). Cada campo mostra origem (arquivo vs. manual). Edição manual permitida; campos ausentes explicitamente marcados.
  - *Histórico* — linha do tempo de alterações.

## Upload e processamento

- Upload múltiplo, sempre vinculado a um componente. Validação de tipo conforme componente (compressor → CSV; evaporador/condensador → PDF/XLS).
- Processamento server-side via TanStack server functions:
  - **CSV (compressor)** — parse com PapaParse: extrai modelo, fabricante, fluido, matriz de coeficientes (formato AHRI 540 quando presente), faixa operacional.
  - **XLS (evaporador/condensador)** — parse com SheetJS: extração heurística de capacidade, temperaturas, vazão, queda de pressão.
  - **PDF (evaporador/condensador)** — extração de texto com pdfjs + busca por padrões técnicos.
- Resultado preenche `component_data` marcando origem como `arquivo`. Campos não encontrados ficam ausentes para preenchimento manual.
- Falha de parse → status do arquivo `erro` + mensagem; componente segue utilizável.
- Página **Uploads** (`/uploads`): fila global de todos os arquivos com filtros, status, link para componente, ações de reprocessar/remover.

## Status de prontidão

Recalculado automaticamente após upload, edição manual ou reprocessamento:

- **incompleto** — falta arquivo esperado ou campos mínimos.
- **validando** — arquivos recebidos, parsing em andamento.
- **pronto** — campos mínimos preenchidos + arquivos esperados processados com sucesso.
- **inválido** — falha grave (todos os arquivos com erro, conflito entre dados).

Componentes não-prontos ficam visualmente marcados (badge + ícone) e serão filtráveis pelos motores futuros para evitar uso indevido.

## Catálogo Técnico

- Grid/lista (`/catalog`) com filtros por tipo, status, fabricante, fluido + busca textual.
- Card mostra nome, tipo, fabricante, fluido, status, indicador "pronto para uso futuro".
- Filtro rápido "apenas prontos".
- Detalhe somente-leitura: metadados, arquivos (visualizar/baixar), dados extraídos formatados, checklist de campos, histórico.

## Dashboard

- KPIs: total de componentes, total por tipo, total por status (incompleto/validando/pronto/inválido).
- Lista de uploads recentes (últimos 10).
- Lista de componentes recém-modificados.
- Atalho "Criar componente".

## Administração Técnica (admin)

- Lista de usuários com papéis atuais; atribuir/remover papel.
- Configurações gerais (nome da organização, etc.).

## Preparação para módulos futuros

- `component_data` em JSONB estruturado e versionado por tipo, pronto para alimentar motores de compressor/evaporador/condensador.
- Status `pronto` como gate explícito para futuros solvers.
- Rotas e itens de navegação de Simulação e Relatórios já criados como placeholders, prontos para receber implementação sem mudar a base.
- Server functions organizadas por domínio (componentes, arquivos, parsing, status) para extensão limpa.

## Fluxos validados nesta entrega

1. Criar componente → 2. Anexar arquivos → 3. Visualizar arquivos vinculados → 4. Visualizar dados extraídos e campos ausentes → 5. Visualizar status → 6. Consultar componente no catálogo.

## Detalhes técnicos

- TanStack Start com rotas: `/`, `/auth`, `/dashboard`, `/components`, `/components/new`, `/components/$id`, `/uploads`, `/catalog`, `/catalog/$id`, `/simulation`, `/reports`, `/admin/users`, `/admin/settings`.
- Lovable Cloud (Supabase) para auth, banco, storage e RLS.
- Server functions para upload, parsing (PapaParse/SheetJS/pdfjs), recálculo de status, auditoria.
- Layouts protegidos `_authenticated` e `_admin` (RBAC via `has_role()`).
- shadcn/ui + Tailwind v4, tokens da paleta CN Cold em `styles.css`.

## Fora do escopo (próximas etapas)

Cálculo térmico, solver de equilíbrio, simulação dinâmica, comparação entre sistemas, otimização, PDF técnico final, integrações CRM/ERP.
