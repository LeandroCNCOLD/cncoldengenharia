# ATUALIZAÇÃO: Catálogo de Ventiladores CN Coils

**Contexto:**
Adicionar o catálogo completo de ventiladores axiais e centrífugos ao projeto.
Os arquivos anexados contêm:
- `fans.json` — 459 modelos de ventiladores com fabricante, série, tipo e dados de performance
- CSVs de curvas de performance axiais (`Tbl_Fan_Axial_*.csv`) e centrífugos (`Tbl_Fan_Centr_Dati.csv`)

### Ações:

1. **Grave** `fans.json` em `public/data/catalogs/fans.json`.

2. **Crie** a tipagem em `src/modules/cn_coils/types/catalogs.ts`:
```typescript
export interface Fan {
  id: number;
  model: string;
  series: string;
  type: 'Axial' | 'Centrifugal' | 'EC' | string;
  builder: string;
  diameterMm?: number;
  powerW?: number;
  voltageV?: number;
  currentA?: number;
  speedRpm?: number;
  airflowM3h?: number;
  maxPressurePa?: number;
}
```

3. **Atualize** o hook `useCnCoilsCatalogs` para carregar `fans.json` e disponibilizá-lo via `fans: Fan[]`.

4. **Atualize** o componente de seleção de ventilador no workspace para usar o catálogo real em vez de dados estáticos.

5. **Não** implemente a lógica de cruzamento curva × perda de carga agora — apenas o catálogo e a seleção.

Execute `npx tsc --noEmit` ao final.
