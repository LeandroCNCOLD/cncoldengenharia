# Auditoria das bibliotecas de ventiladores CN COILS

## 1. Arquivos verificados

- `public/data/catalogs/unilabCoefficients.json`
- `public/data/catalogs/unilabCoefficients.report.json`

Ambos os arquivos existem e foram lidos diretamente durante a auditoria.

## 2. Totais encontrados

| Grupo | Total |
|---|---:|
| `coilCorrections` | 114 |
| `subcoolingCorrections` | 39 |
| `fans.axial` | 1328 |
| `fans.centrifugal` | 115 |
| `correlations.coilDesigner` | 321 |
| `correlations.heatExchanger` | 3285 |

## 3. Quantidade de axiais com curva X/Y válida

- 580 ventiladores axiais possuem `curve.x[]` e `curve.y[]` com mesmo tamanho, mais de um ponto e valores não zerados.

## 4. Quantidade de axiais com polinômio válido

- 149 ventiladores axiais possuem `polynomial.coefficients[]` com pelo menos um coeficiente diferente de zero.

## 5. Quantidade de axiais sem curva utilizável

- 599 ventiladores axiais não possuem curva X/Y válida nem polinômio utilizável.
- Esses registros não foram removidos do JSON.
- Na avaliação, retornam warning e método seguro (`range_only` ou `unavailable`).

## 6. Quantidade de centrífugos com range válido

- 115 ventiladores centrífugos possuem `capacityRange_m3h.max > 0` e `pressureRange_Pa.max > 0`.
- O join por `CodVentRif` foi preservado no arquivo consolidado via `rawCurve`.

## 7. Limitações ainda existentes

- As curvas centrífugas (`rawCurve` com `Vet1...Vet43`) ainda não são interpretadas nesta etapa.
- Para centrífugos, a avaliação retorna:
  - `pressure_Pa: null`
  - `method: "range_only"`
  - warning: `Curva centrífuga ainda não interpretada nesta etapa.`
- Alguns ventiladores axiais possuem apenas faixa operacional ou dados zerados; nesses casos não há extrapolação nem cálculo inventado.

## 8. Correções feitas

- Adicionadas funções ao service:
  - `getFanById`
  - `evaluateFanCurve`
  - interpolação linear segura para curvas X/Y
- Regras implementadas:
  - curva X/Y válida tem prioridade
  - polinômio só é usado quando há pelo menos um coeficiente não zero
  - vazão fora da faixa é limitada com warning em português
  - centrífugos não interpretam `rawCurve` nesta etapa
  - ventilador inexistente retorna `method: "unavailable"`
- Criado `AirSidePanel.tsx`:
  - dropdown pesquisável com ventiladores reais
  - exibição de modelo, tipo, faixa, potência, corrente e rotação
  - seleção preenche vazão nominal estimada
  - vazão permanece editável
- Atualizado `ResultPanel.tsx` com card `Ventilador`.

## 9. Resultado dos testes

Testes executados contra `public/data/catalogs/unilabCoefficients.json`:

1. Axial com curva X/Y válida: OK (`method: "curve"`, pressão finita)
2. Axial com vazão abaixo da faixa: OK (vazão limitada com warning)
3. Axial com vazão acima da faixa: OK (vazão limitada com warning)
4. Axial com polinômio zerado: OK (polinômio zerado não foi usado; curva válida teve prioridade)
5. Axial sem curva utilizável: OK (`method: "range_only"` com warning)
6. Centrífugo com range válido: OK (`method: "range_only"` com warning de curva ainda não interpretada)
7. Ventilador inexistente: OK (`method: "unavailable"` com warning)
8. Simulação sem ventilador selecionado: OK (UI informa vazão manual)

Nenhum caso gerou `NaN`, `Infinity` ou erro de execução no teste do service.

## 10. Status final

OK
