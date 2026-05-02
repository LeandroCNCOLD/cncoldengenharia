import { resolveFieldWithKey } from "./fieldNormalizer";
import { parseNullableNumber } from "./number";
import { detectUnitFromFieldName, toWatts, fromWatts } from "./unitConverter";

export interface ReadNumberWithUnitResult {
  rawValue: unknown;
  value: number | null;
  detectedUnit: string;
  valueW: number | null;
  valueKcalh: number | null;
}

export function readNumberWithUnit(
  row: Record<string, unknown>,
  target: string,
  aliasesMap: Record<string, string[]>,
  defaultUnit: string,
): ReadNumberWithUnitResult {
  const { value: rawValue, matchedKey } = resolveFieldWithKey(row, target, aliasesMap);
  const numericValue = parseNullableNumber(rawValue);

  const detectedUnit = (matchedKey ? detectUnitFromFieldName(matchedKey) : null) ?? defaultUnit;

  if (numericValue === null) {
    return {
      rawValue,
      value: null,
      detectedUnit,
      valueW: null,
      valueKcalh: null,
    };
  }

  const valueW = toWatts(numericValue, detectedUnit);
  const valueKcalh = fromWatts(valueW, "kcal/h");

  return {
    rawValue,
    value: numericValue,
    detectedUnit,
    valueW,
    valueKcalh,
  };
}
