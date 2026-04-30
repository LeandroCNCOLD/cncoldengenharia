# Validacao Coil Simulator - Catalogo CN

Rota alvo: `/coldpro/equipamentos/a9ea377d-ce67-4f54-986a-69585241b7f0/coil-simulator`

Equipamento CN testado: `CN-1200-LT` / `CN 1200 LT`

Modelo de evaporador testado: `133228_C_S F Lantery EVP - CN COLD 24T 4NR 1250A 7P 12NC`

## Resumo

| Item | Status | Observacao |
| --- | --- | --- |
| Build | OK | `npm run build` passou. |
| Lint direcionado | OK | ESLint passou nos arquivos alterados. |
| Typecheck | OK | `npx tsc --noEmit` passou. |
| Evaporador com catalogo CN | Parcial | Dados reais carregam e calculam; erro empirico vs catalogo = -10,0%. |
| Condensador com catalogo CN | Falhou por dado ausente | Nao existe registro em `condenser_coil_models` para os condensadores atuais. |
| UI manual | Nao concluida | Provider bloqueou novas sessoes de navegador por limite de imagens/documentos. Validacao tecnica foi feita por dados reais + thermalcalc em script. |

## Campos preenchidos - evaporador

Fonte: `evaporator_coil_models.component_item_id = 7d6eff2f-915f-40df-a5c0-c1dc8c0feae2`

- Geometria:
  - `rows`: 4
  - `tubes_per_row`: 24
  - `circuits`: 12
  - `length_mm`: 1250 mm
  - `fin_pitch_mm`: 7 mm
  - `tube_od_mm`: 13,3 mm
  - `tube_id_mm`: 12,6 mm
  - `surface_area_m2`: 30,19 m2
  - `internal_volume_l`: 15 L
- Lado ar:
  - `nominal_airflow_m3h`: 13077 m3/h
  - `nominal_air_temp_in_c`: -25 C
  - `nominal_air_temp_out_c`: -27,4 C
  - `face_velocity_ms`: 3,81 m/s
  - `air_pressure_drop_pa`: 113 Pa
  - `rh_in_pct`: 85 %
- Lado fluido:
  - `refrigerant`: R404A
  - `nominal_evap_temp_c`: -35 C
  - `superheat_k`: 8 K
  - `subcooling_k`: 3 K
  - `refrigerant_mass_flow_kgh`: 568 kg/h
  - `vapour_velocity_ms`: 11,43 m/s
  - `liquid_velocity_ms`: 0,08 m/s
  - `refrigerant_pressure_drop_kpa`: 7,3 kPa
- Ponto da curva:
  - `nominal_capacity_w`: 13312 W
  - `nominal_sensible_w`: 12616 W
  - `nominal_latent_w`: 696 W

## Resultado evaporador

Catalogo:

- Capacidade catalogo: 13312 W
- Conversao catalogo: 11446,26 kcal/h
- Conversao validada: 11446,26 kcal/h x 1,163 = 13312 W

Thermalcalc empirico:

- Capacidade calculada: 11980,80 W
- Capacidade calculada: 10301,63 kcal/h
- Erro vs catalogo: -10,0 %
- DT real: 10 K
- Delta P ar calculado: 310,97 Pa
- Delta P refrigerante calculado: 7,3 kPa
- Warning exibivel: `Velocidade frontal alta (3.81 m/s).`

Thermalcalc fisico simples:

- Capacidade calculada: 2966,78 W
- Capacidade calculada: 2550,97 kcal/h
- Erro vs catalogo: -77,71 %
- Warnings:
  - `Geometria insuficiente para calcular área frontal.`
  - `Modelo físico inconsistente. Verifique área e correlação. (fator necessário ≈ 4.49)`
  - `Sem fatores de geometria Unilab; resultado continua estimado.`

## Resultado condensador

Nao foi possivel validar condensador com catalogo CN nesta base.

Evidencia:

- Existem itens `component_items.kind = condensador`.
- `condenser_coil_models` retornou `null` para os condensadores encontrados.
- A consulta geral retornou `condCount = 0`.

Status: Falhou por ausencia de dados de catalogo, nao por erro do motor.

## Problemas encontrados

1. A rota nao tinha botao proprio `Carregar dados do catálogo`; dependia apenas de prefill via `localStorage`.
2. Implementado botao `Carregar dados do catálogo` na rota do simulador.
3. O botao carrega o primeiro coil de catalogo do equipamento para o tipo selecionado.
4. Se houver campos editados manualmente, o usuario recebe confirmacao antes de sobrescrever.
5. Nao ha dados de condensador em `condenser_coil_models` para validar rejeicao de calor real.

## Proximos ajustes

1. Popular `condenser_coil_models` com ao menos um condensador CN aprovado.
2. Expor seletor quando houver mais de um coil de catalogo no equipamento, em vez de carregar sempre o primeiro.
3. Mostrar na UI a origem `catalogo` e o componente carregado.
4. Usar `surface_area_m2` e `internal_volume_l` no motor fisico/hibrido quando disponiveis para reduzir o erro do fisico simples.
5. Reexecutar validacao manual completa assim que o provider de navegador permitir nova sessao.
