"use client";

import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import type { FlareDetail } from "@/lib/types";
import { BAND_M, BAND_MHZ } from "@/lib/types";
import { pct } from "@/lib/format";
import { useWidth } from "@/lib/useWidth";

const H = 150;
const M = { l: 44, r: 8, t: 26, b: 22 };
const ORDER = ["3", "5", "7", "10", "14", "18", "21", "24", "28"];

function Panel({ flare, band }: { flare: FlareDetail; band: string }) {
  const [wrap, W] = useWidth<HTMLElement>(300);
  const c = flare.curves[band];
  const x = scaleLinear()
    .domain([-60, 120])
    .range([M.l, W - M.r]);
  const y = scaleLinear()
    .domain([0, 1.6])
    .range([H - M.b, M.t])
    .clamp(true);
  const ln = line<[number, number | null]>()
    .defined((d) => d[1] != null)
    .x((d) => x(d[0]))
    .y((d) => y(d[1] as number));
  const drop = flare.band_drop[band];
  const thin =
    !c || !c.lit || !c.dark || c.lit.pre_base < 200 || c.dark.pre_base < 200;
  return (
    <figure className="chart" ref={wrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${BAND_M[band]} metre band: daytime versus nighttime signals heard, relative to a normal day`}
      >
        <text x={M.l} y={12} className="title-sm">
          {BAND_M[band]} m
          {W >= 230 && (
            <tspan className="lbl" dx={6}>
              {BAND_MHZ[band]} MHz
            </tspan>
          )}
        </text>
        <text x={W - M.r} y={12} textAnchor="end" className="lbl">
          {thin ? "too little data" : `${pct(drop)} lost`}
        </text>
        <rect
          x={x(flare.start_rel)}
          width={Math.max(1, x(flare.end_rel) - x(flare.start_rel))}
          y={M.t}
          height={H - M.t - M.b}
          fill="var(--sun-wash)"
        />
        <g className="grid">
          <line x1={M.l} x2={W - M.r} y1={y(1)} y2={y(1)} />
        </g>
        <g className="axis">
          <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
          {[0, 1].map((v) => (
            <text key={v} x={M.l - 5} y={y(v)} dy="0.32em" textAnchor="end">
              {v === 1 ? "normal" : "none"}
            </text>
          ))}
          {[-60, 0, 60, 120].map((t) => (
            <text key={t} x={x(t)} y={H - 6} textAnchor="middle">
              {t === 0 ? "peak" : t > 0 ? `+${t}m` : `−${-t}m`}
            </text>
          ))}
        </g>
        {!thin && c?.dark && (
          <path
            d={ln(c.dark.pts) ?? ""}
            fill="none"
            stroke="var(--night)"
            strokeWidth={1.3}
          />
        )}
        {!thin && c?.lit && (
          <path
            d={ln(c.lit.pts) ?? ""}
            fill="none"
            stroke="var(--sun)"
            strokeWidth={1.7}
          />
        )}
      </svg>
    </figure>
  );
}

export default function BandCurves({ flare }: { flare: FlareDetail }) {
  return (
    <div className="multiples">
      {ORDER.map((b) => (
        <Panel key={b} flare={flare} band={b} />
      ))}
    </div>
  );
}
