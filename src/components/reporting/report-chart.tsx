"use client";

/**
 * report-chart.tsx — a SINGLE renderer for all 9 Asana chart types.
 *
 * Consumes the exact engine response contract from POST /api/reports/query
 * ({ data, seriesKeys, total }) plus a ChartType and a couple of annotation
 * flags (showDataLabels, benchmark). One component powers the builder's live
 * preview, the dashboard grid, and the fullscreen expand dialog so they can
 * never drift.
 *
 * Types imported from the shared contract (src/lib/report-config.ts).
 */

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  LabelList,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type {
  ChartType,
  ChartDataRow,
  ChartSeriesKey,
} from "@/lib/report-config";

export interface ReportChartProps {
  chartType: ChartType;
  data: ChartDataRow[];
  seriesKeys: ChartSeriesKey[];
  /** Grand total of the primary measure — powers 'number' + donut center. */
  total: number;
  showDataLabels?: boolean;
  benchmark?: number;
  /** Render height in px. Defaults to 200 (grid). Preview/expand pass larger. */
  height?: number;
}

const EMPTY_HEIGHT_FALLBACK =
  "flex items-center justify-center text-slate-400 text-sm";

function isEmpty(data: ChartDataRow[]): boolean {
  return !data || data.length === 0;
}

/** A tiny axis-tick font shared by the cartesian charts. */
const TICK = { fontSize: 11 } as const;

export function ReportChart({
  chartType,
  data,
  seriesKeys,
  total,
  showDataLabels = true,
  benchmark,
  height = 200,
}: ReportChartProps) {
  // ── Number card: a single big value, no axes. ──
  if (chartType === "number") {
    const label = seriesKeys[0]?.name || "Total";
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ height }}
      >
        <p className="text-5xl md:text-6xl font-light text-slate-900 tabular-nums">
          {formatNumber(total)}
        </p>
        <p className="text-sm text-slate-400 mt-2 text-center px-2">{label}</p>
      </div>
    );
  }

  if (isEmpty(data)) {
    return (
      <div className={EMPTY_HEIGHT_FALLBACK} style={{ height }}>
        No data available
      </div>
    );
  }

  // ── Donut: ring with the TOTAL in the center. ──
  if (chartType === "donut") {
    const inner = Math.max(44, Math.round(height * 0.28));
    const outer = Math.max(64, Math.round(height * 0.4));
    return (
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={inner}
              outerRadius={outer}
              dataKey={seriesKeys[0]?.key || "value"}
              paddingAngle={1}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color || "#94a3b8"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconType="circle"
              formatter={(v) => (
                <span className="text-slate-600">{String(v)}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center total overlay */}
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          style={{ bottom: 28 }}
        >
          <span className="text-2xl md:text-3xl font-semibold text-slate-900 tabular-nums leading-none">
            {formatNumber(total)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">
            Total
          </span>
        </div>
      </div>
    );
  }

  // ── Line / Burnup / Burndown: LineChart, one Line per series. ──
  if (chartType === "line" || chartType === "burnup" || chartType === "burndown") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={TICK} />
          <YAxis tick={TICK} allowDecimals={false} width={36} />
          <Tooltip />
          {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {benchmark != null && (
            <ReferenceLine
              y={benchmark}
              stroke="#a8893a"
              strokeDasharray="4 4"
              label={{ value: `Target ${benchmark}`, fontSize: 10, fill: "#a8893a", position: "insideTopRight" }}
            />
          )}
          {seriesKeys.map((sk) => (
            <Line
              key={sk.key}
              type="monotone"
              dataKey={sk.key}
              name={sk.name}
              stroke={sk.color}
              strokeWidth={2}
              dot={{ fill: sk.color, r: 3 }}
              // Burnup's "Total scope" flat line reads better dashed.
              strokeDasharray={
                chartType === "burnup" && sk.key === "scope" ? "5 5" : undefined
              }
            >
              {showDataLabels && seriesKeys.length === 1 && (
                <LabelList dataKey={sk.key} position="top" fontSize={10} />
              )}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ── Lollipop: thin bar + a dot cap per bucket (vertical). ──
  if (chartType === "lollipop") {
    const key = seriesKeys[0]?.key || "value";
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
          barCategoryGap="35%"
        >
          <XAxis type="number" tick={TICK} allowDecimals={false} />
          <YAxis
            dataKey="name"
            type="category"
            width={100}
            tick={TICK}
            interval={0}
          />
          <Tooltip />
          {benchmark != null && (
            <ReferenceLine
              x={benchmark}
              stroke="#a8893a"
              strokeDasharray="4 4"
            />
          )}
          <Bar dataKey={key} barSize={3} radius={[0, 2, 2, 0]} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color || "#64748b"} />
            ))}
            {/* The lollipop "candy" — a labelled dot at the value end. */}
            <LabelList
              dataKey={key}
              content={(props: LabelContentProps) => (
                <LollipopDot {...props} data={data} valueKey={key} />
              )}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── Horizontal bar. ──
  if (chartType === "bar") {
    const single = seriesKeys.length <= 1;
    const key = seriesKeys[0]?.key || "value";
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={TICK} allowDecimals={false} />
          <YAxis dataKey="name" type="category" width={100} tick={TICK} interval={0} />
          <Tooltip />
          {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {benchmark != null && (
            <ReferenceLine x={benchmark} stroke="#a8893a" strokeDasharray="4 4" />
          )}
          {single ? (
            <Bar dataKey={key} radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color || "#64748b"} />
              ))}
              {showDataLabels && (
                <LabelList dataKey={key} position="right" fontSize={10} />
              )}
            </Bar>
          ) : (
            seriesKeys.map((sk) => (
              <Bar key={sk.key} dataKey={sk.key} name={sk.name} fill={sk.color} radius={[0, 4, 4, 0]}>
                {showDataLabels && (
                  <LabelList dataKey={sk.key} position="right" fontSize={10} />
                )}
              </Bar>
            ))
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── Column / Stacked / Grouped: vertical BarChart. ──
  const stacked = chartType === "stackedBar";
  const single = seriesKeys.length <= 1;
  const primaryKey = seriesKeys[0]?.key || "value";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={TICK} interval={0} />
        <YAxis tick={TICK} allowDecimals={false} width={36} />
        <Tooltip />
        {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {benchmark != null && (
          <ReferenceLine
            y={benchmark}
            stroke="#a8893a"
            strokeDasharray="4 4"
            label={{ value: `Target ${benchmark}`, fontSize: 10, fill: "#a8893a", position: "insideTopRight" }}
          />
        )}
        {single ? (
          <Bar dataKey={primaryKey} radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color || "#64748b"} />
            ))}
            {showDataLabels && (
              <LabelList dataKey={primaryKey} position="top" fontSize={10} />
            )}
          </Bar>
        ) : (
          seriesKeys.map((sk) => (
            <Bar
              key={sk.key}
              dataKey={sk.key}
              name={sk.name}
              fill={sk.color}
              stackId={stacked ? "a" : undefined}
              radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            >
              {showDataLabels && !stacked && (
                <LabelList dataKey={sk.key} position="top" fontSize={10} />
              )}
            </Bar>
          ))
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Lollipop candy dot (rendered as a LabelList content fn) ──
// recharts passes the label's bounding box as SVG props (x/y/width/height)
// plus the row index. We read only those guaranteed props and derive the
// displayed value + color from the source row, so the callback stays typed
// against the loose LabelContentProps shape below.
interface LabelContentProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  index?: number;
}

interface LollipopDotProps extends LabelContentProps {
  data: ChartDataRow[];
  valueKey: string;
}

function LollipopDot(props: LollipopDotProps) {
  const { x, y, width, height, index, data, valueKey } = props;
  const nx = Number(x) + Number(width);
  const ny = Number(y) + Number(height) / 2;
  if (!isFinite(nx) || !isFinite(ny) || index == null) return null;
  const row = data[index];
  const color = row?.color || "#64748b";
  const value = row?.[valueKey];
  return (
    <g>
      <circle cx={nx} cy={ny} r={5} fill={color} />
      <text
        x={nx + 9}
        y={ny}
        dy={3.5}
        fontSize={10}
        fill="#64748b"
        textAnchor="start"
      >
        {value as number | string}
      </text>
    </g>
  );
}

function formatNumber(n: number): string {
  if (n == null || isNaN(n)) return "0";
  // Keep at most 2 decimals but drop trailing zeros; group thousands.
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default ReportChart;
