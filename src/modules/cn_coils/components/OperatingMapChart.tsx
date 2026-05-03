import { useMemo } from "react";
import type { OperatingMapResult } from "../engines/operatingMap/operatingMapTypes";

interface OperatingMapChartProps {
  result: OperatingMapResult;
  width?: number;
  height?: number;
}

const PADDING = { top: 20, right: 20, bottom: 50, left: 60 };

function fmtBR(value: number, decimals = 1): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function OperatingMapChart({
  result,
  width = 600,
  height = 350,
}: OperatingMapChartProps) {
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;
  const { xRange, yRange } = result;
  const xSpan = xRange.max - xRange.min || 1;
  const ySpan = yRange.max - yRange.min || 1;
  const toX = (t: number) => ((t - xRange.min) / xSpan) * chartW;
  const toY = (q: number) => chartH - ((q - yRange.min) / ySpan) * chartH;

  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = Math.max(1, Math.ceil(xSpan / 6));
    for (let t = Math.ceil(xRange.min / step) * step; t <= xRange.max; t += step) {
      ticks.push(t);
    }
    return ticks;
  }, [xRange, xSpan]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = Math.max(1000, Math.ceil(ySpan / 1000 / 5) * 1000);
    for (let q = 0; q <= yRange.max; q += step) {
      ticks.push(q);
    }
    return ticks;
  }, [yRange, ySpan]);

  return (
    <svg width={width} height={height} className="w-full">
      <g transform={`translate(${PADDING.left},${PADDING.top})`}>
        {xTicks.map((t) => (
          <line key={t} x1={toX(t)} y1={0} x2={toX(t)} y2={chartH} stroke="#e5e7eb" strokeWidth={1} />
        ))}
        {yTicks.map((q) => (
          <line key={q} x1={0} y1={toY(q)} x2={chartW} y2={toY(q)} stroke="#e5e7eb" strokeWidth={1} />
        ))}
        <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="#374151" strokeWidth={1.5} />
        <line x1={0} y1={0} x2={0} y2={chartH} stroke="#374151" strokeWidth={1.5} />

        {xTicks.map((t) => (
          <text key={t} x={toX(t)} y={chartH + 18} textAnchor="middle" fontSize={11} fill="#6b7280">
            {t}°C
          </text>
        ))}
        {yTicks.map((q) => (
          <text key={q} x={-8} y={toY(q) + 4} textAnchor="end" fontSize={11} fill="#6b7280">
            {fmtBR(q / 1000, 0)} kW
          </text>
        ))}
        <text x={chartW / 2} y={chartH + 40} textAnchor="middle" fontSize={12} fill="#374151">
          Temperatura de Evaporação (°C)
        </text>
        <text x={-chartH / 2} y={-45} textAnchor="middle" fontSize={12} fill="#374151" transform="rotate(-90)">
          Capacidade (kW)
        </text>

        {result.curves.map((curve) => {
          const points = curve.points;
          if (points.length < 2) return null;
          const d = points
            .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.evapTempC).toFixed(1)},${toY(p.capacityW).toFixed(1)}`)
            .join(" ");
          const last = points[points.length - 1];
          return (
            <g key={curve.condensingTempC}>
              <path d={d} fill="none" stroke={curve.color} strokeWidth={2} />
              <text x={toX(last.evapTempC) + 4} y={toY(last.capacityW)} fontSize={10} fill={curve.color} dominantBaseline="middle">
                Tc={curve.condensingTempC}°C
              </text>
            </g>
          );
        })}

        {result.designPoint && (
          <g>
            <circle
              cx={toX(result.designPoint.evapTempC)}
              cy={toY(result.designPoint.capacityW)}
              r={6}
              fill="#1d4ed8"
              stroke="white"
              strokeWidth={2}
            />
            <text x={toX(result.designPoint.evapTempC) + 8} y={toY(result.designPoint.capacityW) - 8} fontSize={10} fill="#1d4ed8">
              Projeto: {fmtBR(result.designPoint.capacityW / 1000, 1)} kW
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
