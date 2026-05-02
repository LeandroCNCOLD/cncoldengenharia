
## Problema

O catálogo `public/data/equipment/compressors.json` contém **10.301 compressores**:
- **Copeland: 9.191 modelos** ✅ (estão lá)
- Bristol: 1.104 modelos
- Bitzer: 6 modelos (versão completa Bitzer está separada em `compressors_bitzer.json`, com seu próprio browser)

Os Copeland **existem no JSON** mas na prática "não aparecem" na tela `/coldpro/components` → aba **Compressor** porque o `CompressorLibraryBrowser`:

1. Renderiza todos os 9.191 modelos Copeland como `<button>` numa única coluna **sem virtualização** → o navegador trava ou demora vários segundos quando você clica em "Copeland".
2. Tem **apenas busca textual livre** — sem filtros por refrigerante, tipo (scroll/recip/etc), aplicação, faixa de capacidade. Com 9k itens vira "agulha no palheiro".
3. A lista de fabricantes não mostra contagem de forma destacada, então o usuário não percebe que Copeland tem 9k modelos.

## Solução

Reescrever `src/modules/coldpro/components/components/CompressorLibraryBrowser.tsx` aplicando o mesmo padrão de qualidade do `FanLibraryBrowser` recém-melhorado.

### 1. Virtualização da lista de modelos

Usar `@tanstack/react-virtual` (já é parte do ecossistema TanStack do projeto; se não estiver instalado, adicionar via `bun add @tanstack/react-virtual`) para renderizar apenas os itens visíveis na coluna "Modelos". Isso resolve o travamento ao selecionar Copeland.

### 2. Filtros faceted (header)

Adicionar uma barra de filtros logo abaixo do header com:

- **Refrigerante** (multi-select) — derivado de `item.refrigerant[]` distintos do JSON
- **Tipo** (select) — `scroll`, `reciprocating`, `screw`, etc., derivado de `item.type`
- **Aplicação** (select) — `refrigeration`, `air_conditioning`, `heat_pump` (de `application_type`)
- **Capacidade mínima (kW)** — input numérico, filtra `cooling_capacity_kw >= valor`
- **Capacidade máxima (kW)** — input numérico
- **Buscar modelo/fabricante** — mantém o input de texto livre atual
- Botão **"Limpar filtros"**

Os valores possíveis de cada facet são calculados via `useMemo` a partir do dataset completo.

### 3. Contador dinâmico e UX

- Mostrar `{filtered.length} de {data.length} modelos` no header
- Coluna "Fabricantes" continua mostrando contagem por fabricante (já existe), mas refletindo o resultado **após filtros**
- Quando o usuário troca de fabricante, manter os filtros ativos
- Default: nenhum fabricante pré-selecionado (evita render acidental dos 9k Copeland antes do filtro)

### 4. Reorganização visual da aba Compressor

Em `ComponentsPage.tsx`, dentro do bloco `activeTab === "compressor"`, manter os dois browsers mas com títulos claros:

- **"Catálogo Bitzer (oficial)"** → `BitzerLibraryBrowser` (compressores Bitzer reais, não os 6 do dataset misto)
- **"Catálogo geral (Copeland · Bristol · outros)"** → `CompressorLibraryBrowser` virtualizado

Adicionar um pequeno header textual antes de cada um para o usuário entender que são duas fontes distintas.

## Arquivos afetados

- `src/modules/coldpro/components/components/CompressorLibraryBrowser.tsx` — reescrita completa (virtualização + filtros)
- `src/modules/coldpro/pages/ComponentsPage.tsx` — adicionar títulos de seção antes dos dois browsers
- `package.json` — possivelmente `bun add @tanstack/react-virtual` se ainda não estiver presente

## Garantias

- ✅ Sem alterações no JSON (`compressors.json` permanece com os 9.191 Copeland)
- ✅ Sem alterações no `coldpro_v2`
- ✅ Sem alterações no `useEquipmentLibrary.ts` (interface `LibraryCompressor` já cobre todos os campos necessários)
- ✅ Validação com `tsc --noEmit` ao final

## Resultado esperado

Ao abrir `/coldpro/components` → Compressor:
1. Aba mostra "Catálogo geral" com 10.301 modelos disponíveis
2. Clicar em "Copeland" lista os 9.191 modelos **instantaneamente** (virtualizado)
3. Filtros permitem reduzir a, ex.: Copeland + R-404A + scroll + 5–15 kW → ~30 modelos
4. Catálogo Bitzer separado continua funcionando como hoje
