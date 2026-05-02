# ATUALIZAÇÃO: Catálogo Completo de Geometrias CN Coils

**Contexto:**
O arquivo `geometries.json` contém 753 geometrias de baterias organizadas por tipo de aplicação:
- `evaporator_dx` — 131 geometrias de expansão direta
- `evaporator_pump` — 118 geometrias de evaporadores a bomba
- `cooling` — 121 geometrias de resfriamento (água gelada)
- `heating` — 133 geometrias de aquecimento
- `steam` — 119 geometrias a vapor
- `condenser` — 131 geometrias de condensação

### Ações:

1. **Grave** `geometries.json` em `public/data/catalogs/geometries.json`.

2. **Atualize** o hook `useCnCoilsCatalogs` para carregar e disponibilizar as geometrias filtradas por tipo:
```typescript
const geometriesByType = useMemo(() =>
  geometries.filter(g => g.type === componentType), [geometries, componentType]
);
```

3. **Atualize** o modal de seleção de geometria para usar os dados do JSON em vez de dados estáticos ou hardcoded.

4. **Garanta** que ao selecionar uma geometria, os campos da barra inferior sejam preenchidos automaticamente com os valores do JSON (auto-fill já corrigido anteriormente).

Execute `npx tsc --noEmit` ao final.
