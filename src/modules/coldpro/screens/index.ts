/**
 * Screens — telas (páginas) do ColdPro.
 *
 * Convenção:
 * - Os arquivos de **rota** ficam em `src/routes/_app/coldpro/*` (TanStack
 *   Start exige file-based routing; não dá para mover sem quebrar URLs).
 * - Cada rota delega o conteúdo para um componente-tela aqui ou em
 *   `@/components/coldpro`. Telas atuais inline serão extraídas
 *   gradualmente — quando isso acontecer, exportar daqui.
 *
 * Para o Cursor: adicionar novas telas aqui e importar a partir do route file:
 *
 *   // src/routes/_app/coldpro/minha-tela.tsx
 *   import { MinhaTelaScreen } from "@/modules/coldpro/screens";
 *   export const Route = createFileRoute(...)({ component: MinhaTelaScreen });
 */

export { EquipmentListPage as EquipmentListScreen } from "@/components/coldpro/equipment-list-page";
