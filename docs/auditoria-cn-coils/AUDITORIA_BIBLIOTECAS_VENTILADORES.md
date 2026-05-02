# Auditoria — Bibliotecas de Ventiladores (CN COILS)

**Data:** 2026-05-02
**Fonte:** `COEFF_COMPLETO_UNILAB_VAPCYC.zip`
**Consolidado em:** `public/data/catalogs/unilabCoefficients.json` (+ `unilabCoefficients.report.json`)
**Módulo:** `src/modules/unilab_simulator/` (rota atual: `/coldpro/unilab/workspace`)

> `src/modules/coldpro_v2` e `src/modules/unilab_simulator/engine` **não foram alterados**.

---

## 1. Quais arquivos do ZIP foram instalados

Todos os 13 arquivos do ZIP foram inspecionados. As fontes principais foram consolidadas em **um único** JSON (`unilabCoefficients.json`) com o schema solicitado:

```jsonc
{
  "coilCorrections": [],          // 114 (placeholder removido)
  "subcoolingCorrections": [],    // 39
  "fans": {
    "axial": [],                  // 1328
    "centrifugal": []             // 115
  },
  "correlations": {
    "coilDesigner": [],           // 321
    "heatExchanger": []           // 3285
  }
}
```

| Origem (ZIP) | Destino (consolidado) | Registros |
|---|---|---|
| `coilCorrectionCoefficients_principal.json` | `coilCorrections` | 115 → **114** (1 placeholder removido) |
| `coilSubcoolingCoefficients_principal.json` | `subcoolingCorrections` | 39 |
| `fanAxial_type0_config1_principal.json` (curva X/Y) | `fans.axial` (`source: "curve"`) | 346 |
| `fanAxial_type0_config2_principal.json` (polinômio) | `fans.axial` (`source: "polynomial"`) | 390 |
| `fanAxial_type1_config1_principal.json` (curva X/Y) | `fans.axial` (`source: "curve"`) | 252 |
| `fanAxial_type1_config2_principal.json` (polinômio) | `fans.axial` (`source: "polynomial"`) | 340 |
| `fanCentrifugal_data_principal.json` | `fans.centrifugal` | 115 |
| `vapcyc_coildesigner_correlations.json` | `correlations.coilDesigner` | 321 |
| `vapcyc_hx_correlations.json` | `correlations.heatExchanger` | 3285 |

Arquivos do ZIP **não consolidados** (redundantes ou metadados):
- `coilCorrectionCoefficients_backup.json`, `coilCorrectionCoefficients_fluids.json` — duplicatas do principal
- `coilSubcoolingCoefficients_fluids.json` — duplicata
- `fanCentrifugal_curves_principal.json` — pontos brutos (Vet1..Vet43); avaliação de curva centrífuga foi diferida nesta etapa
- `index.json` — metadados

## 2. Totais finais

| Categoria | Esperado | Obtido |
|---|---|---|
| `coilCorrections` | 114 | **114** ✅ |
| `subcoolingCorrections` | 39 | **39** ✅ |
| `fans.axial` | 1328 | **1328** ✅ |
| `fans.centrifugal` | 115 | **115** ✅ |
| `correlations.coilDesigner` | 321 | **321** ✅ |
| `correlations.heatExchanger` | 3285 | **3285** ✅ |

## 3. Auditoria — ventiladores axiais com curva X/Y

- Total com curva: **598**
- **Utilizáveis** (algum X≠0 e algum Y≠0): **580**
- Inutilizáveis (curva totalmente zerada): 18

Critério aplicado em `isAxialCurveUsable()`:
```ts
fan.curve.x.some(v => v !== 0) && fan.curve.y.some(v => v !== 0)
```

## 4. Auditoria — ventiladores axiais com polinômio

- Total com polinômio: **730**
- **Utilizáveis** (algum Coeff_n ≠ 0): **149**
- **Inutilizáveis** (polinômio zerado): **581**

Critério aplicado em `isAxialPolynomialUsable()`:
```ts
fan.polyCoefficients.some(c => c !== 0)
```

> Polinômios zerados foram **mantidos** no JSON (origem fiel ao ZIP) mas **rejeitados em runtime** por `evaluateFanCurve()`. O dropdown do AirSidePanel só lista ventiladores utilizáveis (`listUsableAxialFans()`).

## 5. Quantidade de centrífugos com range válido

- Total: 115
- **Com range operacional válido** (`MinRound > 0` e `MaxRound > MinRound`): **115** ✅

Avaliação completa de curva centrífuga (interpolação dos pontos `Vet1..Vet43`) **não foi implementada** nesta etapa, conforme escopo.

## 6. Limitações ainda existentes

1. Centrífugos: avaliação só por range. Curva detalhada será necessária para correlacionar pressão estática × vazão.
2. `coilDesigner`/`heatExchanger`: dados textuais armazenados; ainda não consumidos por nenhum motor.
3. 18 axiais com curva e 581 axiais com polinômio são reportados mas não selecionáveis (dados zerados na fonte).

## 7. Correções feitas

- Substituição da fonte inexistente `/data/catalogs/fans_clean.json` (404 silencioso) pela consolidada `/data/catalogs/unilabCoefficients.json` no `AirSidePanel`.
- Dropdown de ventiladores agora filtra somente os **utilizáveis**.
- Adicionado cálculo de pressão estática em runtime via `evaluateFanCurve()` (linear-piecewise para curva, polinômio de 4ª ordem para `Coeff1..Coeff5`).
- Painel de resultado mostra status da biblioteca (utilizáveis vs zerados).

## 8. Resultado dos testes

- `npx tsc --noEmit`: **OK** (zero erros)
- `npm run build`: **OK**
- `coldpro_v2`: **intacto**
- `engine` antigo: **intacto**
- Rota `/coldpro/unilab/workspace`: continua funcionando

## 9. Status final

**OK** — biblioteca de ventiladores instalada, normalizada, auditada e avaliável via `evaluateFanCurve()`.
