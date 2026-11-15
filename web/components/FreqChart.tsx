"use client";

import { scaleLinear, scalePoint } from "d3-scale";
import type { Results, Summary } from "@/lib/types";
import { pct } from "@/lib/format";
import { useWidth } from "@/lib/useWidth";

const H = 300;
const M = { l: 62, r: 178, t: 16, b: 40 };
const ORDER = ["3", "5", "7", "10", "14", "18", "21", "24", "28"];

export default function FreqChart({ res }: { res: Results }) {
  const [wrap, W] = useWidth<HTMLElement>(620);
  const fr = res.event_study.frequency;
  const bands = ORDER.filter((b) => fr[b]);
  const x = scalePoint<string>()
    .domain(bands)
    .range([M.l + 10, W - M.r - 10]);
  const y = scaleLinear()
    .domain([-0.2, 1])
    .range([H - M.b, M.t])
    .clamp(true);

  const series: {
    key: "x" | "m5x1" | "placebo";
    label: string;
    color: string;
    dash?: string;
  }[] = [
    { key: "x", label: "biggest flares (X)", color: "var(--sun)" },
    { key: "m5x1", label: "strong flares (M5 to X1)", color: "var(--ink)" },
    { key: "placebo", label: "no flare (comparison)", color: "var(--night)", dash: "3 3" },
  ];

  const pts = (k: "x" | "m5x1" | "placebo") =>
    bands
      .map((b) => [b, fr[b][k]] as [string, Summary])
      .filter(([, s]) => s.n >= 20 && s.median != null);

  return (
    <figure className="chart" ref={wrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Typical share of daytime signals lost on each radio band, for the biggest flares, strong flares and no-flare comparison times"
      >
        <g className="grid">
          {[0, 0.5, 1].map((v) => (
            <line key={v} x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} />
          ))}
        </g>
        <g className="axis">
          {[0, 0.5, 1].map((v) => (
            <text key={v} x={M.l - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {v === 0 ? "no loss" : pct(v)}
            </text>
          ))}
          <text
            x={12}
            y={(M.t + H - M.b) / 2}
            transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}
            textAnchor="middle"
            className="lbl"
          >
            daytime signals lost
          </text>
          {bands.map((b) => (
            <text key={b} x={x(b)} y={H - M.b + 16} textAnchor="middle">
              {fr[b].band_m}{W >= 480 ? " m" : ""}
            </text>
          ))}
          <text
            x={(M.l + W - M.r) / 2}
            y={H - 6}
            textAnchor="middle"
            className="lbl"
          >
            {W < 640 ? "radio band (low frequency on the left)" : "radio band: low frequencies (left) are absorbed most, high frequencies (right) least"}
          </text>
        </g>
        {series.map((s, si) => {
          const p = pts(s.key);
          if (!p.length) return null;
          const dx = (si - 1) * 9; // side by side so the ranges do not overlap
          const X = (b: string) => (x(b) as number) + dx;
          // pen up across a band with too few events, so no line bridges the gap
          let d = "";
          let pen = false;
          for (const b of bands) {
            const v = fr[b][s.key];
            if (v.n >= 20 && v.median != null) {
              d += `${pen ? "L" : "M"}${X(b)},${y(v.median)}`;
              pen = true;
            } else pen = false;
          }
          const last = p[p.length - 1];
          return (
            <g key={s.key}>
              {p.map(([b, v]) => (
                <line
                  key={b}
                  x1={X(b)}
                  x2={X(b)}
                  y1={y(v.p25 as number)}
                  y2={y(v.p75 as number)}
                  stroke={s.color}
                  strokeOpacity={0.45}
                  strokeWidth={2}
                />
              ))}
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dash}
              />
              {p.map(([b, v]) => (
                <circle
                  key={b}
                  cx={X(b)}
                  cy={y(v.median as number)}
                  r={4}
                  fill={s.color}
                  stroke="var(--paper)"
                  strokeWidth={2}
                >
                  <title>{`${s.label}, ${fr[b].band_m} m: typical loss ${pct(v.median)} (middle half ${pct(v.p25)} to ${pct(v.p75)}), ${v.n} events`}</title>
                </circle>
              ))}
              <text
                x={X(last[0]) + 10}
                y={y(last[1].median as number)}
                dy="0.32em"
                className="lbl"
                style={{ fill: "var(--ink)" }}
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
