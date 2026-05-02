# Catálogos UNILAB

Esta pasta deve conter os JSONs de catálogos UNILAB consumidos pelo módulo
`src/modules/unilab_simulator/`.

Os arquivos são carregados via `fetch('/data/catalogs/<arquivo>.json')` em
runtime (lazy loading) — nunca importados pelo bundle.

## Arquivos esperados

| Arquivo | Conteúdo esperado |
|---|---|
| `coilGeometries.json` | `CoilGeometryCatalogItem[]` — geometria base (passos, diâmetros, uBase opcional) |
| `tubeMaterials.json` | Materiais de tubo com condutividade térmica `W/(m·K)` |
| `finPitches.json` | Passos de aleta disponíveis (mm) |
| `finThicknesses.json` | Espessuras de aleta disponíveis (mm) |
| `refrigerantsPure.json` | Refrigerantes puros (id, nome, propriedades) |
| `refrigerantsMixtures.json` | Misturas/blends |
| `coilCorrectionCoefficients.json` | `AirVelocityCorrectionItem[]` — polinômio até 7ª ordem por geometria |
| `pressureDropFan.json` | `PressureDropFanItem[]` — coeficientes de perda de carga lado ar |

## Regras

- Enquanto qualquer arquivo estiver ausente, o botão **Simular Componente**
  fica desabilitado e a UI mostra "Catálogo UNILAB não carregado".
- **Não criar mocks** nem inventar valores. Faltou catálogo → bloqueia.
- Estrutura dos itens segue `src/modules/unilab_simulator/types/unilab.types.ts`.
