"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface GoalProgressChartProps {
  progress: number;
  period?: string;
  startDate: string;
  endDate?: string;
}

export function GoalProgressChart({
  progress,
  period,
  startDate,
  endDate,
}: GoalProgressChartProps) {
  const chartInfo = useMemo(() => {
    const start = new Date(startDate);
    const end = endDate
      ? new Date(endDate)
      : new Date(start.getFullYear(), start.getMonth() + 3, 0);
    const today = new Date();

    const data = [];
    const totalDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    let currentDate = new Date(start);
    let dataIndex = 0;

    while (currentDate <= end) {
      const dayIndex = Math.ceil(
        (currentDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const expectedProgress = Math.round((dayIndex / totalDays) * 100);

      data.push({
        index: dataIndex,
        date: currentDate.toISOString(),
        month: months[currentDate.getMonth()],
        year: currentDate.getFullYear(),
        expected: Math.min(expectedProgress, 100),
        // Filled in below for the current point only. We have no stored
        // history of past values, so plotting a line here would be an
        // invented trend — only today's real number is charted.
        actual: null as number | null,
        showYear: dataIndex === 0,
      });

      dataIndex++;
      // Step to the 1st of the next month in one go. Bumping the month on a
      // 29th–31st start date overflows (Jan 31 → Mar 3) and skips a month.
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1
      );
    }

    // The marker sits on the last plotted point that today has reached, not
    // on an exact date match — the points are month-firsts, so an exact
    // match would only ever hit on the 1st.
    let todayIdx = -1;
    if (today >= start && today <= end) {
      for (let i = 0; i < data.length; i++) {
        if (new Date(data[i].date) <= today) todayIdx = i;
      }
    }
    if (todayIdx >= 0) data[todayIdx].actual = progress;

    return { data, todayIdx };
  }, [progress, startDate, endDate]);

  const { data: chartData, todayIdx } = chartInfo;
  const todayData = todayIdx >= 0 ? chartData[todayIdx] : null;

  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-center gap-4 mb-2 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-gray-200" />
          Expected pace
        </span>
        {todayData && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#c9a84c]" />
            Today
          </span>
        )}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
          >
            <defs>
              <linearGradient id="expectedGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#E5E7EB" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#E5E7EB" stopOpacity={0.4} />
              </linearGradient>
              <pattern
                id="diagonalStripes"
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
              >
                <path
                  d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4"
                  stroke="#D1D5DB"
                  strokeWidth="1.5"
                />
              </pattern>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#F3F4F6"
            />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#9CA3AF" }}
              dy={10}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#9CA3AF" }}
              tickFormatter={(value) => `${value}%`}
              dx={-10}
            />

            {/* Today reference line */}
            {todayData && (
              <ReferenceLine
                x={todayData.month}
                stroke="#9CA3AF"
                strokeDasharray="3 3"
                label={{
                  value: "Today",
                  position: "top",
                  fill: "#6B7280",
                  fontSize: 12,
                }}
              />
            )}

            {/* Expected progress area (striped) */}
            <Area
              type="monotone"
              dataKey="expected"
              stroke="#D1D5DB"
              fill="url(#diagonalStripes)"
              strokeWidth={2}
            />

            {/* Actual progress — one dot at today, the only measured value */}
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#c9a84c"
              fill="transparent"
              strokeWidth={2}
              dot={(props: { cx?: number; cy?: number; payload?: { index?: number } }) => {
                const { cx, cy, payload } = props;
                if (payload?.index === todayIdx && cx !== undefined && cy !== undefined) {
                  return (
                    <circle
                      key="today-dot"
                      cx={cx}
                      cy={cy}
                      r={6}
                      fill="#c9a84c"
                      stroke="white"
                      strokeWidth={2}
                    />
                  );
                }
                return <g key={`empty-${cx}-${cy}`} />;
              }}
            />

            <Tooltip
              formatter={(value, name) => [
                `${value}%`,
                name === "expected" ? "Expected" : "Actual",
              ]}
              labelFormatter={(label) => String(label)}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Year label below chart */}
      {chartData[0] && (
        <div className="flex justify-start pl-12 mt-1">
          <span className="text-xs text-gray-400">{chartData[0].year}</span>
        </div>
      )}
    </div>
  );
}
