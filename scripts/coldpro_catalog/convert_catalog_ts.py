#!/usr/bin/env python3
"""
Conversor da planilha CN COLD para src/modules/coldpro_catalog/data/equipmentCatalog.raw.ts

Lê uma planilha XLSX (sheet "Sheet1" ou primeira aba) e gera o arquivo
TypeScript com EQUIPMENT_CATALOG_RAW. Inclui os campos detalhados de
geometria do evaporador e da serpentina de reaquecimento, populados
APENAS quando as colunas correspondentes existirem na planilha — nunca
inventa valores.

Uso:
    python convert_catalog_ts.py <input.xlsx> <output.ts>

Mapeamento coluna -> campo TS é controlado por COLUMN_MAP. Ajuste se a
planilha trouxer cabeçalhos diferentes; aliases adicionais são suportados.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd


# Mapeamento canônico: chave = campo TS, valor = lista de cabeçalhos aceitos
# (case/acentos/espacos sao normalizados). Cada item da lista e tratado como alias.
COLUMN_MAP: dict[str, list[str]] = {
    # Identificação
    "id": ["id", "modelo_unico", "modelo_codigo", "codigo"],
    "modelo": ["modelo"],
    "modeloUnico": ["modelo_unico", "modelounico"],
    "modeloBaseReferencia": ["modelo_base_referencia", "modelo_base"],
    # Classificação
    "family": ["family", "familia", "tipo_equipamento"],
    "application": ["application", "aplicacao", "linha_aplicacao"],
    # Fabricante / compressor
    "fabricante": ["fabricante"],
    "fabricanteOrigem": ["fabricante_origem"],
    "compressorModelo": ["compressor_modelo", "modelo_compressor"],
    "compressorCodigo": ["compressor_codigo", "codigo_compressor"],
    "tipoCompressor": ["tipo_compressor"],
    # Refrigerante
    "refrigerante": ["refrigerante", "fluido"],
    # Elétrica
    "tensaoV": ["tensao_v", "tensao", "voltagem"],
    "numeroFases": ["numero_fases", "fases"],
    "frequenciaHz": ["frequencia_hz", "frequencia"],
    "configuracaoEletrica": ["configuracao_eletrica"],
    # Comercial
    "linha": ["linha"],
    "designacaoHp": ["designacao_hp", "hp"],
    "gabinete": ["gabinete"],
    "tipoGabinete": ["tipo_gabinete"],
    # Capacidades
    "capacidadeFrigorificaKcalH": ["capacidade_frigorifica_kcal_h", "capacidade_kcal_h"],
    "capacidadeCompressorKcalH": ["capacidade_compressor_kcal_h"],
    "calorRejeitadoKcalH": ["calor_rejeitado_kcal_h"],
    # Potência e corrente
    "potenciaEletricaKw": ["potencia_eletrica_kw", "potencia_kw"],
    "potenciaCompressorKw": ["potencia_compressor_kw"],
    "potenciaVentiladorKw": ["potencia_ventilador_kw"],
    "correnteA": ["corrente_a", "corrente"],
    "correntePartidaA": ["corrente_partida_a", "corrente_partida"],
    # Performance
    "cop": ["cop"],
    "gwp": ["gwp"],
    # Condições
    "tempEvaporacaoC": ["temp_evaporacao_c", "t_evap_c"],
    "tempCondensacaoC": ["temp_condensacao_c", "t_cond_c"],
    "tempAmbienteC": ["temp_ambiente_c", "t_amb_c"],
    "tempCamaraC": ["temp_camara_c", "t_camara_c"],
    "umidadeCamaraPercent": ["umidade_camara_percent", "umidade_camara"],
    # Vazões de ar
    "vazaoArEvaporadorM3H": ["vazao_ar_evaporador_m3_h", "vazao_ar_evap"],
    "vazaoArCondensadorM3H": ["vazao_ar_condensador_m3_h", "vazao_ar_cond"],
    # Degelo
    "tipoDegelo": ["tipo_degelo"],
    # Geometria condensador
    "condensadorRows": ["condensador_rows"],
    "condensadorTubesPorRow": ["condensador_tubes_por_row"],
    "condensadorCircuitos": ["condensador_circuitos"],
    "condensadorFinSpacingMm": ["condensador_fin_spacing_mm"],
    "condensadorLengthMm": ["condensador_length_mm"],
    "condensadorTuboDiametroMm": ["condensador_tubo_diametro_mm"],
    # Geometria evaporador (básica)
    "evaporadorRows": ["evaporador_rows"],
    "evaporadorTubesPorRow": ["evaporador_tubes_por_row"],
    "evaporadorCircuitos": ["evaporador_circuitos"],
    "evaporadorFinSpacingMm": ["evaporador_fin_spacing_mm"],
    "evaporadorLengthMm": ["evaporador_length_mm"],
    "evaporadorTuboDiametroMm": ["evaporador_tubo_diametro_mm"],
    "evaporadorVolumeInternoL": ["evaporador_volume_interno_l"],
    "evaporadorAreaSuperficieM2": ["evaporador_area_superficie_m2"],
    # Geometria evaporador (detalhada — para ProgressiveCoilInput)
    "evaporadorTubeInnerDiameterMm": ["evaporador_tube_inner_diameter_mm"],
    "evaporadorTubePitchTransverseMm": ["evaporador_tube_pitch_transverse_mm"],
    "evaporadorTubePitchLongitudinalMm": ["evaporador_tube_pitch_longitudinal_mm"],
    "evaporadorFinHeightMm": ["evaporador_fin_height_mm"],
    "evaporadorFinThicknessMm": ["evaporador_fin_thickness_mm"],
    "evaporadorCoilWidthM": ["evaporador_coil_width_m"],
    "evaporadorCoilHeightM": ["evaporador_coil_height_m"],
    "evaporadorTubeMaterial": ["evaporador_tube_material"],
    "evaporadorFinMaterial": ["evaporador_fin_material"],
    "evaporadorAirTemperatureInC": ["evaporador_air_temperature_in_c"],
    "evaporadorAirRelativeHumidityIn": ["evaporador_air_relative_humidity_in"],
    "evaporadorAirMassFlowKgS": ["evaporador_air_mass_flow_kg_s"],
    # Linhas
    "linhaSucao": ["linha_sucao"],
    "linhaDescarga": ["linha_descarga"],
    "linhaLiquido": ["linha_liquido"],
    # Térmicos
    "superaquecimentoTotalK": ["superaquecimento_total_k"],
    "superaquecimentoUtilK": ["superaquecimento_util_k"],
    "subresfriamentoK": ["subresfriamento_k"],
    "altitudeM": ["altitude_m"],
    # Água / dreno
    "quantidadeAguaLH": ["quantidade_agua_l_h"],
    "diametroDreno": ["diametro_dreno"],
    # Reaquecimento (para ReheatCoilSizingInput)
    "reheatQTargetW": ["reheat_q_target_w", "reaquecimento_q_w"],
    "reheatTAirInC": ["reheat_t_air_in_c"],
    "reheatTAirOutC": ["reheat_t_air_out_c"],
    "reheatAirMassFlowKgS": ["reheat_air_mass_flow_kg_s"],
    "reheatTCondensingC": ["reheat_t_condensing_c"],
    "reheatTHotGasInC": ["reheat_t_hot_gas_in_c"],
    "reheatTubeOuterDiameterM": ["reheat_tube_outer_diameter_m"],
    "reheatTubeThicknessM": ["reheat_tube_thickness_m"],
    "reheatFinSpacingM": ["reheat_fin_spacing_m"],
    "reheatFinThicknessM": ["reheat_fin_thickness_m"],
    "reheatTubePitchTransversalM": ["reheat_tube_pitch_transversal_m"],
    "reheatTubePitchLongitudinalM": ["reheat_tube_pitch_longitudinal_m"],
    "reheatCoilLengthM": ["reheat_coil_length_m"],
    "reheatCircuits": ["reheat_circuits"],
}

NUMERIC_FIELDS = {
    "tensaoV", "numeroFases", "frequenciaHz",
    "capacidadeFrigorificaKcalH", "capacidadeCompressorKcalH", "calorRejeitadoKcalH",
    "potenciaEletricaKw", "potenciaCompressorKw", "potenciaVentiladorKw",
    "correnteA", "correntePartidaA", "cop", "gwp",
    "tempEvaporacaoC", "tempCondensacaoC", "tempAmbienteC", "tempCamaraC",
    "umidadeCamaraPercent", "vazaoArEvaporadorM3H", "vazaoArCondensadorM3H",
    "condensadorRows", "condensadorTubesPorRow", "condensadorCircuitos",
    "condensadorFinSpacingMm", "condensadorLengthMm", "condensadorTuboDiametroMm",
    "evaporadorRows", "evaporadorTubesPorRow", "evaporadorCircuitos",
    "evaporadorFinSpacingMm", "evaporadorLengthMm", "evaporadorTuboDiametroMm",
    "evaporadorVolumeInternoL", "evaporadorAreaSuperficieM2",
    "evaporadorTubeInnerDiameterMm", "evaporadorTubePitchTransverseMm",
    "evaporadorTubePitchLongitudinalMm", "evaporadorFinHeightMm",
    "evaporadorFinThicknessMm", "evaporadorCoilWidthM", "evaporadorCoilHeightM",
    "evaporadorAirTemperatureInC", "evaporadorAirRelativeHumidityIn",
    "evaporadorAirMassFlowKgS",
    "superaquecimentoTotalK", "superaquecimentoUtilK", "subresfriamentoK", "altitudeM",
    "quantidadeAguaLH",
    "reheatQTargetW", "reheatTAirInC", "reheatTAirOutC", "reheatAirMassFlowKgS",
    "reheatTCondensingC", "reheatTHotGasInC", "reheatTubeOuterDiameterM",
    "reheatTubeThicknessM", "reheatFinSpacingM", "reheatFinThicknessM",
    "reheatTubePitchTransversalM", "reheatTubePitchLongitudinalM",
    "reheatCoilLengthM", "reheatCircuits",
}

ENUM_VALUES = {
    "evaporadorTubeMaterial": {"copper", "aluminum", "steel"},
    "evaporadorFinMaterial": {"copper", "aluminum", "steel"},
}


def normalize_header(value: str) -> str:
    s = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def build_alias_index(df_columns: list[str]) -> dict[str, str]:
    """Mapeia campo TS -> nome real da coluna no DataFrame."""
    norm_to_real = {normalize_header(c): c for c in df_columns}
    resolved: dict[str, str] = {}
    for ts_field, aliases in COLUMN_MAP.items():
        for alias in aliases:
            n = normalize_header(alias)
            if n in norm_to_real:
                resolved[ts_field] = norm_to_real[n]
                break
    return resolved


def coerce_value(field: str, raw):
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    if field in NUMERIC_FIELDS:
        try:
            v = float(raw)
            if pd.isna(v):
                return None
            return v
        except (TypeError, ValueError):
            return None
    if field in ENUM_VALUES:
        s = str(raw).strip().lower()
        return s if s in ENUM_VALUES[field] else None
    return str(raw).strip()


def ts_literal(value) -> str:
    if value is None:
        return "undefined"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value.is_integer():
            return repr(int(value)) + ".0"
        return repr(value)
    return json.dumps(str(value), ensure_ascii=False)


def row_to_ts(row: dict[str, object]) -> str:
    lines = ["  {"]
    for field in COLUMN_MAP.keys():
        if field == "raw":
            continue
        if field not in row:
            continue
        v = row[field]
        if v is None:
            continue
        if field in {"family", "application", "refrigerante"}:
            lines.append(f"    {field}: {json.dumps(v, ensure_ascii=False)},")
        else:
            lines.append(f"    {field}: {ts_literal(v)},")
    lines.append("    raw: {},")
    lines.append("  },")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("Uso: python convert_catalog_ts.py <input.xlsx> <output.ts>")
        return 2

    src = Path(argv[1])
    dst = Path(argv[2])
    if not src.exists():
        print(f"Arquivo de entrada não encontrado: {src}")
        return 1

    df = pd.read_excel(src, sheet_name=0)
    aliases = build_alias_index(list(df.columns))

    rows_ts: list[str] = []
    skipped = 0
    for _, raw_row in df.iterrows():
        record: dict[str, object] = {}
        for ts_field, real_col in aliases.items():
            record[ts_field] = coerce_value(ts_field, raw_row[real_col])

        # Defaults mínimos exigidos pelo tipo
        record.setdefault("id", record.get("modelo"))
        record.setdefault("modelo", record.get("id"))
        record.setdefault("modeloUnico", record.get("id"))
        record.setdefault("family", "unknown")
        record.setdefault("application", "unknown")
        record.setdefault("refrigerante", "unknown")

        if not record.get("id") or not record.get("modelo"):
            skipped += 1
            continue

        rows_ts.append(row_to_ts(record))

    header = (
        "// AUTO-GENERATED — DO NOT EDIT MANUALLY\n"
        f"// Source: {src.name}\n"
        "// Generated by convert_catalog_ts.py\n\n"
        "import type { CatalogEquipmentRow } from './equipmentCatalog.types';\n\n"
        "export const EQUIPMENT_CATALOG_RAW: CatalogEquipmentRow[] = [\n"
    )
    body = "\n".join(rows_ts) + "\n"
    footer = "];\n"

    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(header + body + footer, encoding="utf-8")

    print(f"OK: {len(rows_ts)} linhas escritas em {dst}. Ignoradas: {skipped}.")
    print(f"Colunas mapeadas ({len(aliases)}): {sorted(aliases.keys())}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
