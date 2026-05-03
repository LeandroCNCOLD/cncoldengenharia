import { useMemo } from "react";
import type { CycleResult } from "../engines/cycle/cycleTypes";

interface Props {
  result: CycleResult;
  refrigerantId: string;
  width?: number;
  height?: number;
}

const MARGIN = { top: 30, right: 30, bottom: 50, left: 60 };

function fmt(n: number, digits = 1): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function CyclePHDiagram({
  result,
  refrigerantId,
  width = 600,
  height = 380,
}: Props) {
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const { point1_evapOut, point2_compOut, point3_condOut, point4_valveOut } =
    result.statePoints;
  const points = [
    point1_evapOut,
    point2_compOut,
    point3_condOut,
    point4_valveOut,
  ];
  const hValues = points.map((p) => p.h_kJkg);
  const pValues = points.map((p) => p.P_kPa);
  const hMin = Math.min(...hValues) * 0.95;
  const hMax = Math.max(...hValues) * 1.05;
  const pMin = Math.max(1, Math.min(...pValues) * 0.7);
  const pMax = Math.max(...pValues) * 1.3;

  const scaleH = useMemo(
    () => (h: number) => ((h - hMin) / Math.max(hMax - hMin, 1e-6)) * innerW,
    [hMin, hMax, innerW],
  );
  const scaleP = useMemo(
    () => (p: number) => {
      const logMin = Math.log10(pMin);
      const logMax = Math.log10(pMax);
      return (
        innerH -
        ((Math.log10(Math.max(p, 1e-6)) - logMin) /
          Math.max(logMax - logMin, 1e-6)) *
          innerH
      );
    },
    [pMin, pMax, innerH],
  );

  const colors = {
    evaporation: "#3b82f6",
    compression: "#ef4444",
    condensation: "#f97316",
    expansion: "#8b5cf6",
  };

  const cycleLines = [
    {
      from: point4_valveOut,
      to: point1_evapOut,
      color: colors.evaporation,
      label: "Evaporação",
      dashed: false,
    },
    {
      from: point1_evapOut,
      to: point2_compOut,
      color: colors.compression,
      label: "Compressão",
      dashed: false,
    },
    {
      from: point2_compOut,
      to: point3_condOut,
      color: colors.condensation,
      label: "Condensação",
      dashed: false,
    },
    {
      from: point3_condOut,
      to: point4_valveOut,
      color: colors.expansion,
      label: "Expansão",
      dashed: true,
    },
  ];

  const pGridValues = useMemo(() => {
    const vals: number[] = [];
    let p = Math.pow(10, Math.ceil(Math.log10(pMin)));
    while (p <= pMax) {
      vals.push(p);
      p *= 2;
    }
    return vals;
  }, [pMin, pMax]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Diagrama P-h do ciclo de refrigeração com ${refrigerantId}`}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {pGridValues.map((p) => (
            <g key={p}>
              <line
                x1={0}
                y1={scaleP(p)}
                x2={innerW}
                y2={scaleP(p)}
                stroke="#374151"
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
              <text
                x={-8}
                y={scaleP(p) + 4}
                textAnchor="end"
                fontSize={10}
                fill="#9ca3af"
              >
                {p >= 1000 ? `${fmt(p / 1000, 1)}MPa` : `${fmt(p, 0)}kPa`}
              </text>
            </g>
          ))}

          {cycleLines.map((line) => (
            <line
              key={line.label}
              x1={scaleH(line.from.h_kJkg)}
              y1={scaleP(line.from.P_kPa)}
              x2={scaleH(line.to.h_kJkg)}
              y2={scaleP(line.to.P_kPa)}
              stroke={line.color}
              strokeWidth={2.5}
              strokeDasharray={line.dashed ? "6,3" : undefined}
            />
          ))}

          {points.map((pt, i) => (
            <g key={i}>
              <circle
                cx={scaleH(pt.h_kJkg)}
                cy={scaleP(pt.P_kPa)}
                r={6}
                fill={
                  i === 0
                    ? colors.evaporation
                    : i === 1
                      ? colors.compression
                      : i === 2
                        ? colors.condensation
                        : colors.expansion
                }
                stroke="white"
                strokeWidth={1.5}
              />
              <text
                x={scaleH(pt.h_kJkg) + 9}
                y={scaleP(pt.P_kPa) - 8}
                fontSize={11}
                fontWeight="bold"
                fill="white"
              >
                {i + 1}
              </text>
              <text
                x={scaleH(pt.h_kJkg) + 9}
                y={scaleP(pt.P_kPa) + 4}
                fontSize={9}
                fill="#9ca3af"
              >
                {fmt(pt.T_C, 1)}°C
              </text>
            </g>
          ))}

          <line
            x1={0}
            y1={scaleP(point1_evapOut.P_kPa)}
            x2={innerW}
            y2={scaleP(point1_evapOut.P_kPa)}
            stroke={colors.evaporation}
            strokeWidth={1}
            strokeDasharray="8,4"
            opacity={0.4}
          />
          <line
            x1={0}
            y1={scaleP(point2_compOut.P_kPa)}
            x2={innerW}
            y2={scaleP(point2_compOut.P_kPa)}
            stroke={colors.condensation}
            strokeWidth={1}
            strokeDasharray="8,4"
            opacity={0.4}
          />

          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#6b7280" />
          <text
            x={innerW / 2}
            y={innerH + 38}
            textAnchor="middle"
            fontSize={11}
            fill="#9ca3af"
          >
            Entalpia específica (kJ/kg)
          </text>
          {[hMin, (hMin + hMax) / 2, hMax].map((h, i) => (
            <g key={i}>
              <line
                x1={scaleH(h)}
                y1={innerH}
                x2={scaleH(h)}
                y2={innerH + 5}
                stroke="#6b7280"
              />
              <text
                x={scaleH(h)}
                y={innerH + 18}
                textAnchor="middle"
                fontSize={10}
                fill="#9ca3af"
              >
                {fmt(h, 0)}
              </text>
            </g>
          ))}

          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#6b7280" />
          <text
            x={-innerH / 2}
            y={-45}
            textAnchor="middle"
            fontSize={11}
            fill="#9ca3af"
            transform="rotate(-90)"
          >
            Pressão (kPa) — escala log
          </text>

          {cycleLines.map((line, i) => (
            <g key={line.label} transform={`translate(${innerW - 130}, ${10 + i * 18})`}>
              <line
                x1={0}
                y1={7}
                x2={18}
                y2={7}
                stroke={line.color}
                strokeWidth={2}
                strokeDasharray={line.dashed ? "4,2" : undefined}
              />
              <text x={22} y={11} fontSize={10} fill="#d1d5db">
                {line.label}
              </text>
            </g>
          ))}

          <text
            x={innerW / 2}
            y={-12}
            textAnchor="middle"
            fontSize={12}
            fontWeight="bold"
            fill="white"
          >
            Diagrama P-h — {refrigerantId}
          </text>
        </g>
      </svg>

      <div className="mt-2 grid grid-cols-4 gap-2 px-2">
        {[
          { label: "Te", value: `${fmt(result.Te_C, 1)}°C`, color: "text-blue-400" },
          { label: "Tc", value: `${fmt(result.Tc_C, 1)}°C`, color: "text-orange-400" },
          { label: "COP", value: fmt(result.COP, 2), color: "text-green-400" },
          { label: "EER", value: fmt(result.EER, 2), color: "text-purple-400" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-gray-900 py-2 text-center">
            <div className="text-xs text-gray-500">{item.label}</div>
            <div className={`text-sm font-bold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
