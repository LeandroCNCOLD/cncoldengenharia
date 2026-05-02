# ATUALIZAÇÃO: Catálogos de Materiais e Componentes CN Coils

**Contexto:**
Os 9 arquivos JSON anexados contêm os catálogos de materiais e componentes físicos das baterias.

### Ações:

1. **Grave** todos os JSONs em `public/data/catalogs/`:
   - `finThicknesses.json` — 14 espessuras de aleta (0.10 a 0.40 mm)
   - `tubeThicknesses.json` — 17 espessuras de tubo (0.25 a 0.60 mm)
   - `finPitches.json` — 33 passos de aleta disponíveis
   - `finHeights.json` — 9 alturas de aleta disponíveis
   - `materials.json` — 8 materiais (Cobre, Alumínio, Inox, etc.)
   - `frameMaterials.json` — 2 materiais de chassi
   - `coilShapes.json` — 6 formatos de serpentina (Reto, L, U, V, W, Z)
   - `finTreatments.json` — Tratamentos de aleta (Hidrofílico: fator 0.9 condução, 0.8 atrito)
   - `powerSupplies.json` — 8 padrões de alimentação elétrica

2. **Atualize** os dropdowns da UI do configurador para usar esses catálogos em vez de valores hardcoded.

3. **Para `finTreatments`:** O campo `FattoreRiduzioneCondTermica` (0.9) e `FattoreRiduzioneFattoreAttritoAria` (0.8) devem ser aplicados no motor de cálculo quando o tratamento Hidrofílico for selecionado.

Execute `npx tsc --noEmit` ao final.
