import { formatAmount } from "@/lib/domain/habits";

export type BarDatum = { label: string; value: number; highlight?: boolean };

export function WeeklyBars({
  data,
  target,
  unit,
  tone = "tomato",
  title,
}: {
  data: BarDatum[];
  target?: number;
  unit: string;
  tone?: "tomato" | "basil" | "saffron" | "sky";
  title: string;
}) {
  const max = Math.max(target ?? 0, ...data.map((item) => item.value), 1);
  const width = 360;
  const height = 158;
  const baseline = 120;
  const top = 10;
  const usable = baseline - top;
  const slot = data.length > 0 ? width / data.length : width;
  const barWidth = Math.min(26, slot * 0.52);
  const tones = {
    tomato: "#c2410c",
    basil: "#3f6b4f",
    saffron: "#b47c1e",
    sky: "#4c6fa8",
  };
  const targetY = target ? baseline - (target / max) * usable : null;
  const summary = data
    .map((item) => `${item.label}: ${formatAmount(item.value, unit)}`)
    .join("; ");

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}. ${summary}`}
        className="h-auto w-full"
      >
        {targetY !== null ? (
          <g>
            <line
              x1={0}
              x2={width}
              y1={targetY}
              y2={targetY}
              stroke="#d9c9b7"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <text
              x={width - 2}
              y={Math.max(10, targetY - 4)}
              textAnchor="end"
              fontSize={9}
              fill="#766b61"
            >
              meta {formatAmount(target ?? 0, unit)}
            </text>
          </g>
        ) : null}
        {data.map((item, index) => {
          const barHeight = item.value > 0 ? Math.max(3, (item.value / max) * usable) : 0;
          const x = index * slot + (slot - barWidth) / 2;
          const y = baseline - barHeight;
          return (
            <g key={`${item.label}-${index}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={6}
                fill={item.highlight ? tones[tone] : `${tones[tone]}99`}
              />
              <text
                x={index * slot + slot / 2}
                y={height - 16}
                textAnchor="middle"
                fontSize={9}
                fill="#766b61"
              >
                {item.label}
              </text>
            </g>
          );
        })}
        <line
          x1={0}
          x2={width}
          y1={baseline}
          y2={baseline}
          stroke="#eadfd2"
          strokeWidth={1}
        />
      </svg>
    </figure>
  );
}

export function StreakDots({
  days,
  active,
}: {
  days: string[];
  active: Set<string>;
}) {
  return (
    <div className="flex gap-2">
      {days.map((day) => {
        const on = active.has(day);
        return (
          <span
            key={day}
            title={`${day}: ${on ? "registrado" : "sem registro"}`}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-[0.6rem] font-semibold ${
              on
                ? "bg-basil text-white"
                : "border border-line bg-surface-soft text-muted"
            }`}
          >
            {day.slice(8, 10)}
          </span>
        );
      })}
    </div>
  );
}

export function MiniTrend({
  points,
  tone = "tomato",
}: {
  points: number[];
  tone?: "tomato" | "basil";
}) {
  if (points.length === 0) return null;
  const width = 120;
  const height = 34;
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const path = points
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-28" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke={tone === "tomato" ? "#c2410c" : "#3f6b4f"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
