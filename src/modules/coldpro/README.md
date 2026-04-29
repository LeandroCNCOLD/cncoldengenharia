# Módulo ColdPro

Estrutura organizacional para separar UI, lógica e dados. Pensada para
permitir que ferramentas externas (Cursor, etc.) evoluam os motores de
cálculo sem tocar no frontend.

```
src/modules/coldpro/
├── screens/      → Telas React (rotas TanStack importam daqui)
├── components/   → Componentes visuais reutilizáveis (tabs, painéis)
├── engines/      → Cálculo puro (coil, system, compressor, performance map)
├── services/     → Integração API/Supabase (CRUD, importadores)
├── types/        → Tipos TypeScript compartilhados
└── data/         → Tabelas técnicas, parsers Unilab, constantes
```

## Regras

1. **Telas** ficam em `screens/` — apenas composição de componentes + hooks.
2. **Componentes** em `components/` não fazem cálculo numérico pesado.
3. **Cálculo** sempre via funções de `engines/` (puras, testáveis).
4. **Tipos compartilhados** em `types/`.
5. **Dados técnicos / parsers** em `data/`.
6. **Chamadas a Supabase / server functions** em `services/`.

## Compatibilidade

Esta camada é composta majoritariamente por **barrel files** que re-exportam
do código atual (`src/modules/coldpro/coil`, `system`, `unilab`,
`src/lib/coldpro`, `src/components/coldpro`, etc.). Isso preserva todos os
imports existentes enquanto oferece uma fachada estável para novo código.

**Para novo código**, prefira importar de:

```ts
import { ... } from "@/modules/coldpro/engines";
import { ... } from "@/modules/coldpro/services";
import { ... } from "@/modules/coldpro/types";
import { ... } from "@/modules/coldpro/components";
import { ... } from "@/modules/coldpro/screens";
import { ... } from "@/modules/coldpro/data";
```

Os caminhos antigos continuam válidos durante a migração gradual.
