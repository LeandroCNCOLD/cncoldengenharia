# Relatório de Extração — Catálogo de Compressores ColdPro V2

## Resumo

| Fabricante | Modelos únicos | Observação |
|---|---|---|
| Copeland (Emerson) | 11756 | 1 registro por modelo, refrigerantes como array |
| Bitzer | 495 | 1 registro por modelo, todos os refrigerantes compatíveis |
| **TOTAL** | **12251** | |

## Distribuição por aplicação

| Aplicação | Modelos |
|---|---|
| LT (Congelados) | 726 |
| MT (Resfriados) | 5722 |
| HT (Climatizados / AC) | 5803 |

## Distribuição por refrigerante primário

| Refrigerante | Modelos |
|---|---|
| R404A | 3626 |
| R22 | 3216 |
| R410A | 2525 |
| R134a | 1034 |
| R407C | 961 |
| R454B | 657 |
| R448A | 207 |
| R507A | 15 |
| R449A | 10 |


## Arquivos gerados

| Arquivo | Tamanho | Destino no projeto |
|---|---|---|
| `copeland.json` | 5888 KB | `public/data/compressors/copeland.json` |
| `bitzer.json` | 280 KB | `public/data/compressors/bitzer.json` |
| `index.json` | 3438 KB | `public/data/compressors/index.json` |
| `compressorCatalog.types.ts` | — | `src/modules/coldpro_catalog/data/` |
| `compressorCatalog.service.ts` | — | `src/modules/coldpro_catalog/data/` |
| `compressorCoefficients.raw.ts` | 184 KB | `src/modules/coldpro_catalog/data/` |

## Estratégia de carregamento

O frontend carrega apenas o **índice leve** (`index.json`, 3438 KB) na inicialização.
Os dados completos por fabricante são carregados **sob demanda** quando o usuário seleciona um modelo.

## Integração com CompressorSpec do motor

```typescript
import { filterCompressors, getCompressorById, toCompressorSpec } from './compressorCatalog.service';

// Buscar modelos R404A para LT
const results = await filterCompressors({ application: 'LT', refrigerant: 'R404A' });

// Carregar dados completos e converter para o motor
const row = await getCompressorById(results[0].id);
const spec = toCompressorSpec(row, { evap_temp_c: -30, cond_temp_c: 40 });
// spec é CompressorSpec compatível com evaluateSystemEquilibrium()
```

## Coeficientes Polinomiais (compressorCoefficients.raw.ts)

- 216 conjuntos ASHRAE 10-coeff expandido (Copeland)
- C0–C19: capacidade frigorífica | W0–W19: potência elétrica
- Refrigerantes: R-410A, R-454B | 50 Hz e 60 Hz
- Integração futura com `generatePolynomialCoefficients()` do motor
