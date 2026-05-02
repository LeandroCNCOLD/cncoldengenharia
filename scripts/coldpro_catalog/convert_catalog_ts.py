#!/usr/bin/env python3
"""
Conversor da planilha CN COLD para
src/modules/coldpro_catalog/data/equipmentCatalog.raw.ts

Lê a aba "480 modelos" (header na linha 1) e gera o arquivo TypeScript
EQUIPMENT_CATALOG_RAW. Inclui geometria de aletado (condensador,
evaporador e reaquecimento) lendo as colunas reais da planilha.

NUNCA inventa valores: se a célula estiver vazia ou contiver "-",
o campo correspondente fica `undefined`.

Uso:
    python convert_catalog_ts.py <input.xlsx> <output.ts>
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd


# ---------------------------------------------------------------------------
# Mapeamento por nome EXATO da coluna na planilha (após .strip())
# Cada entrada: campo_ts -> [aliases possíveis]
# A normalização compara ignorando acentos, case, espaços extras e símbolos.
# ---------------------------------------------------------------------------
COLUMN_MAP: dict[str, list[str]] = {
    # Identificação
    "id": ["MODELO_UNICO", "MODELO"],
    "modelo": ["MODELO"],
    "modeloUnico": ["MODELO_UNICO"],
    "modeloCatalogoOriginal": ["MODELO_CATALOGO_ORIGINAL"],
    "modeloBaseReferencia": ["MODELO_BASE_REFERENCIA"],
    "statusCompressor": ["STATUS_COMPRESSOR"],
    # Fabricante / compressor
    "fabricante": ["FABRICANTE"],
    "fabricanteOrigem": ["FABRICANTE_ORIGEM"],
    "compressorModelo": ["COMPRESSOR"],
    "compressorCodigo": ["COMPRESSOR_CODIGO"],
    "tipoCompressor": ["TIPO_COMPRESSOR"],
    # Elétrica
    "configuracaoEletrica": ["CONFIGURACAO_ELETRICA"],
    "tensaoComercial": ['TENSÃO ELÉTRICA [v]'],
    "tensaoV": ["TENSAO_V"],
    "numeroFases": ["NUMERO_FASES"],
    "frequenciaHz": ["FREQUENCIA_HZ"],
    # Comercial
    "linha": ["LINHA"],
    "designacaoHp": ['DESIGNAÇÃO COMERCIAL EM "HP"'],
    "gabinete": ["GABINETE"],
    "tipoGabinete": ["TIPO DE GABINETE"],
    # Refrigerante
    "refrigerante": ["REFRIGERANTE"],
    # Capacidades
    "capacidadeFrigorificaKcalH": [
        "CAPACIDADE FRIGORÍFICA (Kcal/h) [Capacidade do REAQUECIMENTO]",
        "CAPACIDADE FRIGORÍFICA (Kcal/h) [Capacidade do evaporador]",
    ],
    "capacidadeCompressorKcalH": ["CAPACIDADE FRIGORÍFICA (Kcal/h) [Capacidade do compressor]"],
    "calorRejeitadoKcalH": ["CALOR REJEITADO (Kcal/h) [Capacidade do condensador]"],
    # Potência / corrente totais (circuito completo)
    "potenciaEletricaKw": ["POTÊNCIA ELÉTRICA REQUERIDA TOTAL [CIRCUITO COMPLETO] (kW)", "POTÊNCIA ELÉTRICA REQUERIDA TOTAL (kW)"],
    "potenciaCompressorKw": ["POTÊNCIA ELÉTRICA REQUERIDA COMPRESSOR (kW)"],
    "potenciaVentiladorKw": ["POTÊNCIA ELÉTRICA REQUERIDA VENTILADOR (kW)"],
    "correnteA": ["CORRENTE ELÉTRICA ESTIMADA [CIRCUITO COMPLETO] (A)", "CORRENTE ELÉTRICA ESTIMADA (A)"],
    "correntePartidaA": ["CORRENTE ELÉTRICA DE PARTIDA [CIRCUITO COMPLETO] (A)", "CORRENTE ELÉTRICA DE PARTIDA (A)"],
    # Performance
    "cop": ["COP global (kW/kW)", "COP (kW/kW)"],
    "gwp": ["GWP-AR6"],
    "odp": ["ODP-AR6"],
    # Degelo
    "tipoDegelo": ["TIPO DE DEGELO"],
    # ------------------------------------------------------------------
    # CONDENSADOR (geometria + ventilador)
    # ------------------------------------------------------------------
    "condensadorRows": ["Condensador Rows"],
    "condensadorTubesPorRow": ["Condensador tubes_per_row"],
    "condensadorCircuitos": ["Condensador circuits"],
    "condensadorFinSpacingMm": ["Condensador  fin_spacing_mm", "Condensador fin_spacing_mm"],
    "condensadorLengthMm": ["Condensador  length_mm", "Condensador length_mm"],
    "condensadorTuboDiametroIn": ["Ø Tubo_cond [in]"],
    "condensadorTuboDiametroMm": ["Ø Tubo_cond [mm]"],
    "condensadorTuboEspessuraMm": ["ESP. Tubo_cond [mm]"],
    "condensadorGeometria": ["GEOMETRIA CONDENSADOR"],
    "condensadorVolumeInternoL": ["VOLUME INTERNO CONDENSADOR [dm³ = L]"],
    "ventiladorCondensador": ["VENTILADOR CONDENSADOR"],
    "vazaoArCondensadorM3H": ["VAZÃO VENTILADOR CONDENSADOR (m³/h)"],
    # ------------------------------------------------------------------
    # EVAPORADOR (na planilha as colunas usam grafia "Eaporador" / "Evaporador")
    # ------------------------------------------------------------------
    "modeloEvaporador": ["MODELO EVAPORADOR (Circuito pincipal)", "MODELO EVAPORADOR (Circuito principal)"],
    "evaporadorRows": ["EaporadorRows", "EvaporadorRows", "Evaporador Rows", "Eaporador Rows"],
    "evaporadorTubesPorRow": ["Eaporadortubes_per_row", "Evaporadortubes_per_row", "Eaporador tubes_per_row", "Evaporador tubes_per_row"],
    "evaporadorCircuitos": ["Eaporadorcircuits", "Evaporadorcircuits", "Eaporador circuits", "Evaporador circuits"],
    "evaporadorFinSpacingMm": ["Eaporador fin_spacing_mm", "Evaporador fin_spacing_mm"],
    "evaporadorLengthMm": ["Eaporador length_mm", "Evaporador length_mm"],
    "evaporadorTuboDiametroIn": ["Ø Tubo_EVAP [in]"],
    "evaporadorTuboDiametroMm": ["Ø Tubo_EVAP [mm]"],
    "evaporadorTuboEspessuraMm": ["ESP. Tubo_EVAP [mm]"],
    "evaporadorGeometria": ["Geometria evaporador", "Geometria Evaporador"],
    "evaporadorVolumeInternoL": ["VOLUME INTERNO EVAPORADOR [dm³ = L]", "VOLUME INTERNO Eaporador[dm³ = L]", "VOLUME INTERNO Evaporador[dm³ = L]"],
    "evaporadorAreaSuperficieM2": ["ÁREA DA SUPERFICIE DE TROCA EVAPORADOR [m²]", "ÁREA DA SUPERFICIE DE TROCA Eaporador[m²]", "ÁREA DA SUPERFICIE DE TROCA Evaporador[m²]"],
    "evaporadorQuantidade": ["QUANTIDADE DE EVAPORADORES", "QUANTIDADE DE REAQUECIMENTOES"],
    "ventiladorEvaporador": ["VENTILADOR EVAPORADOR", "VENTILADOR REAQUECIMENTO"],
    "vazaoArEvaporadorM3H": ["VAZÃO VENTILADOR EVAPORADOR (m³/h)", "VAZÃO VENTILADOR Eaporador(m³/h)", "VAZÃO VENTILADOR Evaporador(m³/h)"],
    # ------------------------------------------------------------------
    # REAQUECIMENTO (geometria)
    # ------------------------------------------------------------------
    "reheatRows": ["REAQUECIMENTO Rows", "REAQUECIMENTOrows", "REAQUECIMENTORows"],
    "reheatTubesPerRow": ["REAQUECIMENTO tubes_per_row"],
    "reheatCircuits": ["REAQUECIMENTO circuits"],
    "reheatFinSpacingMm": ["REAQUECIMENTO  fin_spacing_mm", "REAQUECIMENTO fin_spacing_mm"],
    "reheatCoilLengthMm": ["REAQUECIMENTO  length_mm", "REAQUECIMENTO length_mm"],
    "reheatGeometria": ["Geometria REAQUECIMENTO"],
    # ------------------------------------------------------------------
    # CONDIÇÕES DE OPERAÇÃO
    # ------------------------------------------------------------------
    "tempCamaraC": ["TEMPERATURA DA CÂMARA (°C)"],
    "umidadeCamaraPercent": ["UMIDADE DA CÂMARA (%)"],
    "tempEvaporacaoC": ["TEMPERATURA DE EVAPORAÇÃO  (°C)", "TEMPERATURA DE EVAPORAÇÃO (°C)"],
    "tempCondensacaoC": ["TEMPERATURA DE CONDENSAÇÃO  (°C)", "TEMPERATURA DE CONDENSAÇÃO (°C)"],
    "tempAmbienteC": ["TEMPERATURA EXTERNA  (°C)", "TEMPERATURA EXTERNA (°C)"],
    "umidadeExternaPercent": ["UMIDADE EXTERNA (%)"],
    "vazaoMassaKgH": ["VAZÃO EM MASSA (kg/h)"],
    "vazaoMassaKgS": ["VAZÃO EM MASSA (kg/s)"],
    "deltaEntalpiaKjKg": ["DIFERENÇA DE ENTALPIA (kJ/kg)"],
    "superaquecimentoTotalK": ["SUPERAQUECIMENTO TOTAL (K)"],
    "superaquecimentoUtilK": ["SUPERAQUECIMENTO ÚTIL (K)"],
    "subresfriamentoK": ["SUBRESFRIAMENTO (K)"],
    "subresfriamentoAdicionalK": ["SUBRESFRIAMENTO ADICIONAL (K)"],
    "altitudeM": ["ALTITUDE (m)"],
    # Linhas
    "linhaDescarga": ["LINHA DE DESCARGA"],
    "velocidadeDescargaMs": ["VELOCIDADE LINHA DE DESCARGA [m/s] (ATÉ 15M)"],
    "linhaLiquido": ["LINHA DE LIQUIDO"],
    "velocidadeLiquidoMs": ["VELOCIDADE LINHA DE LIQUIDO [m/s] (ATÉ 15M)"],
    "linhaSucao": ["LINHA DE SUCÇÃO"],
    "velocidadeSucaoMs": ["VELOCIDADE LINHA DE SUCÇÃO [m/s] (ATÉ 15M)"],
    "cargaFluidoKg": ["CARGA DE FLUÍDO [kg]"],
    # Água / dreno
    "quantidadeAguaLH": ["QUANTIDADE DE ÁGUA PRODUZIDA [ L/h ]"],
    "diametroDreno": ["DIÂMETRO DRENO"],
    "quantidadeDrenos": ["QUANTIDADE DE DRENOS"],
    # Correntes individuais
    "correnteCompressorA": ["CORRENTE ELÉTRICA COMPRESSOR (A)"],
    "correnteVentiladoresA": ["CORRENTE ELÉTRICA VENTILADORES (A)"],
    "copCarnot": ["COP Carnot (K/K)"],
    # Secundário (se aplicável)
    "modeloCondensadorSecundario": ["MODELO CONDENSADOR (SECUNDÁRIO)"],
    "ventiladorCondensadorSecundario": ["VENTILADOR CONDENSADOR SECUNDÁRIO"],
    "vazaoArCondensadorSecundarioM3H": ["VAZÃO VENTILADOR CONDENSADOR SECUNDÁRIO (m³/h)"],
}

# Campos que devem ser convertidos para número (extraindo valor de strings com unidade)
NUMERIC_FIELDS = {
    "tensaoV", "numeroFases", "frequenciaHz",
    "capacidadeFrigorificaKcalH", "capacidadeCompressorKcalH", "calorRejeitadoKcalH",
    "potenciaEletricaKw", "potenciaCompressorKw", "potenciaVentiladorKw",
    "correnteA", "correntePartidaA", "correnteCompressorA", "correnteVentiladoresA",
    "cop", "copCarnot", "gwp", "odp",
    "tempEvaporacaoC", "tempCondensacaoC", "tempAmbienteC", "tempCamaraC",
    "umidadeCamaraPercent", "umidadeExternaPercent",
    "vazaoArEvaporadorM3H", "vazaoArCondensadorM3H", "vazaoArCondensadorSecundarioM3H",
    "vazaoMassaKgH", "vazaoMassaKgS", "deltaEntalpiaKjKg",
    "condensadorRows", "condensadorTubesPorRow", "condensadorCircuitos",
    "condensadorFinSpacingMm", "condensadorLengthMm",
    "condensadorTuboDiametroMm", "condensadorTuboEspessuraMm",
    "condensadorVolumeInternoL",
    "evaporadorRows", "evaporadorTubesPorRow", "evaporadorCircuitos",
    "evaporadorFinSpacingMm", "evaporadorLengthMm",
    "evaporadorTuboDiametroMm", "evaporadorTuboEspessuraMm",
    "evaporadorVolumeInternoL", "evaporadorAreaSuperficieM2",
    "evaporadorQuantidade",
    "reheatRows", "reheatTubesPerRow", "reheatCircuits",
    "reheatFinSpacingMm", "reheatCoilLengthMm",
    "superaquecimentoTotalK", "superaquecimentoUtilK",
    "subresfriamentoK", "subresfriamentoAdicionalK", "altitudeM",
    "velocidadeDescargaMs", "velocidadeLiquidoMs", "velocidadeSucaoMs",
    "cargaFluidoKg", "quantidadeAguaLH", "quantidadeDrenos",
}

# Strings que significam "não informado" e devem virar None
EMPTY_TOKENS = {"", "-", "—", "n/a", "na", "nan", "null", "none"}


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


_NUMBER_RE = re.compile(r"-?\d+(?:[.,]\d+)?")


def extract_number(raw) -> float | None:
    """Aceita números diretos ou strings tipo '2,10 mm', '600 mm', '3/8\"', '9,52'."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        if isinstance(raw, float) and pd.isna(raw):
            return None
        return float(raw)
    s = str(raw).strip()
    if s.lower() in EMPTY_TOKENS:
        return None
    # Procura primeiro número decimal (vírgula ou ponto)
    m = _NUMBER_RE.search(s.replace("\xa0", " "))
    if not m:
        return None
    token = m.group(0).replace(",", ".")
    try:
        return float(token)
    except ValueError:
        return None


def coerce_value(field: str, raw):
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    if field in NUMERIC_FIELDS:
        return extract_number(raw)
    s = str(raw).strip()
    if s.lower() in EMPTY_TOKENS:
        return None
    return s


def detect_application(linha: str | None) -> str:
    if not linha:
        return "unknown"
    u = linha.upper()
    if "AGRO" in u:
        return "AGRO"
    if "HT" in u or "HIGH" in u:
        return "HT"
    if "MT" in u or "MEDIUM" in u:
        return "MT"
    if "LT" in u or "LOW" in u:
        return "LT"
    if "CLIMATIZ" in u:
        return "HT"
    return "unknown"


def detect_family(modelo: str | None) -> str:
    if not modelo:
        return "unknown"
    return "plugin"


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
    # Ordem: campos do COLUMN_MAP + family/application/refrigerante derivados
    for field in row.keys():
        if field == "raw":
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

    # Aba "480 modelos" — header REAL está na linha 1 (índice 1), não 0.
    # A linha 0 traz apenas a célula mesclada "REAQUECIMENTO".
    try:
        df = pd.read_excel(src, sheet_name="480 modelos", header=1)
    except ValueError:
        df = pd.read_excel(src, sheet_name=0, header=1)

    # Guarda nomes ORIGINAIS (com possíveis duplicatas) por índice posicional.
    original_cols = [str(c).strip() for c in df.columns]
    # Pandas renomeia duplicatas para "Nome.1" — desfaz isso para o alias.
    df.columns = original_cols

    # Override posicional: a planilha tem DUAS colunas chamadas "EaporadorRows".
    # A 1ª (col 42) é mesmo do evaporador. A 2ª (col 47) é, na verdade, o
    # número de fileiras do REAQUECIMENTO (confirmado pelo usuário). Renomeia
    # a segunda para um nome único usado pelo alias `reheatRows`.
    seen: dict[str, int] = {}
    new_cols: list[str] = []
    for c in original_cols:
        seen[c] = seen.get(c, 0) + 1
        if c == "EaporadorRows" and seen[c] == 2:
            new_cols.append("REAQUECIMENTO Rows")  # alias de reheatRows
        elif seen[c] > 1:
            new_cols.append(f"{c}__dup{seen[c]}")
        else:
            new_cols.append(c)
    df.columns = new_cols

    aliases = build_alias_index(list(df.columns))

    print(f"Colunas mapeadas: {len(aliases)}/{len(COLUMN_MAP)}")
    missing = [k for k in COLUMN_MAP.keys() if k not in aliases]
    if missing:
        print(f"AVISO: campos sem coluna correspondente na planilha ({len(missing)}):")
        for m in missing:
            print(f"  - {m}  (aliases tentados: {COLUMN_MAP[m]})")

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

        # Derivados
        record["application"] = detect_application(record.get("linha"))
        record["family"] = detect_family(record.get("modelo"))
        if not record.get("refrigerante"):
            record["refrigerante"] = "unknown"

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
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
