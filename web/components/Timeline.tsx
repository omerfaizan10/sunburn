"use client";

import { useRef } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import type { FlareDetail } from "@/lib/types";
import { useWidth } from "@/lib/useWidth";

const M = { l: 52, r: 38 };
const H1 = 120; // X-ray panel
const H2 = 70; // spots panel
const GAP = 36;
const TOP = 26; // room for the panel label above the X-ray plot
const H = TOP + H1 + GAP + H2 + 24;

/** GOES X-ray flux and sunlit/dark spot ratio on a shared time axis; drag to scrub. */
export default function Timeline({
  flare,
  frame,
  onFrame,
}: {
  flare: FlareDetail;
  frame: number;
  onFrame: (i: number) => void;
}) {
  const [wrap, W] = useWidth<HTMLDivElement>(960);
  const ref = useRef<SVGSVGElement>(null);
  const frames = flare.frames;
  const x0 = frames[0].rel;
  const x1 = frames[frames.length - 1].rel + 2;
  const x = scaleLinear()
    .domain([x0, x1])
    .range([M.l, W - M.r]);
  const y = scaleLog()
    .domain([1e-7, 2e-3])
    .range([TOP + H1, TOP])
    .clamp(true);
  const top2 = TOP + H1 + GAP;
  const y2 = scaleLinear()
    .domain([0, 1.6])
    .range([top2 + H2, top2])
    .clamp(true);

  const g = flare.goes.filter(([m]) => m >= x0 && m <= x1);
  const fluxLine = line<[number, number | null]>()
    .defined((d) => d[1] != null && d[1] > 0)
    .x((d) => x(d[0]))
    .y((d) => y(d[1] as number))(g);

  const ratio = (n: number, b: number) => (b >= 15 ? n / b : null);
  const litPts = frames.map(
    (f) =>
      [f.rel + 1, ratio(f.spots[0], f.spots[1])] as [number, number | null],
  );
  const darkPts = frames.map(
    (f) =>
      [f.rel + 1, ratio(f.spots[2], f.spots[3])] as [number, number | null],
  );
  const rl = line<[number, number | null]>()
    .defined((d) => d[1] != null)
    .x((d) => x(d[0]))
    .y((d) => y2(d[1] as number));

  const cur = frames[Math.min(frame, frames.length - 1)];
  const cx = x(cur.rel + 1);

  const pick = (clientX: number) => {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    const rel = x.invert(vx);
    let best = 0;
    let bd = Infinity;
    frames.forEach((f, i) => {
      const d = Math.abs(f.rel + 1 - rel);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    onFrame(best);
  };

  const classes: [string, number][] = [
    ["B", 1e-7],
    ["C", 1e-6],
    ["M", 1e-5],
    ["X", 1e-4],
  ];
  const ticks = [-60, -30, 0, 30, 60, 90].filter((t) => t >= x0 && t <= x1);

  return (
    <div ref={wrap} style={{ width: "100%" }}>
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      role="slider"
      tabIndex={0}
      aria-label="Time relative to flare peak"
      aria-valuemin={0}
      aria-valuemax={frames.length - 1}
      aria-valuenow={frame}
      aria-valuetext={`${Math.round(cur.rel)} minutes from peak`}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pick(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) pick(e.clientX);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight")
          onFrame(Math.min(frames.length - 1, frame + 1));
        else if (e.key === "ArrowLeft") onFrame(Math.max(0, frame - 1));
        else return;
        e.preventDefault();
      }}
    >
      {/* flare interval */}
      <rect
        x={x(flare.start_rel)}
        width={Math.max(1, x(flare.end_rel) - x(flare.start_rel))}
        y={TOP}
        height={H1}
        fill="var(--sun-wash)"
      />
      <rect
        x={x(flare.start_rel)}
        width={Math.max(1, x(flare.end_rel) - x(flare.start_rel))}
        y={top2}
        height={H2}
        fill="var(--sun-wash)"
      />
      {/* class decades */}
      <g className="grid">
        {classes.map(([l, v]) => (
          <line key={l} x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} />
        ))}
      </g>
      <g className="axis">
        {classes.map(([l, v]) => (
          <text key={l} x={W - M.r + 8} y={y(v * 3.16)} dy="0.32em">
            {l}
          </text>
        ))}
        <text x={W - M.r + 8} y={TOP - 8} className="lbl">
          class
        </text>
      </g>
      <path
        d={fluxLine ?? ""}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={1.6}
      />
      <text x={M.l + 6} y={TOP - 8} className="lbl">
        The Sun&apos;s X-ray brightness (NOAA GOES satellite). Higher = stronger flare
      </text>

      {/* spot ratio panel */}
      <g className="grid">
        <line x1={M.l} x2={W - M.r} y1={y2(1)} y2={y2(1)} />
        <line x1={M.l} x2={W - M.r} y1={y2(0)} y2={y2(0)} />
      </g>
      <g className="axis">
        <text x={M.l - 6} y={y2(1)} dy="0.32em" textAnchor="end">
          normal
        </text>
        <text x={M.l - 6} y={y2(0)} dy="0.32em" textAnchor="end">
          none
        </text>
      </g>
      <path
        d={rl(darkPts) ?? ""}
        fill="none"
        stroke="var(--night)"
        strokeWidth={1.4}
      />
      <path
        d={rl(litPts) ?? ""}
        fill="none"
        stroke="var(--sun)"
        strokeWidth={1.8}
      />
      <text x={M.l + 6} y={top2 - 8} className="lbl">
        Radio signals heard, compared with a normal day:
        <tspan className="lbl-sun"> daytime links</tspan>
        <tspan> and </tspan>
        <tspan className="lbl-night">nighttime links</tspan>
      </text>

      {/* time axis */}
      <g className="axis">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top2 + H2} y2={top2 + H2 + 4} />
            <text x={x(t)} y={top2 + H2 + 16} textAnchor="middle">
              {t === 0 ? "flare peak" : t > 0 ? `+${t} min` : `−${-t} min`}
            </text>
          </g>
        ))}
      </g>

      {/* cursor */}
      <line
        x1={cx}
        x2={cx}
        y1={8}
        y2={top2 + H2}
        stroke="var(--sun)"
        strokeWidth={1.5}
      />
      <path d={`M${cx - 5},4 L${cx + 5},4 L${cx},10 Z`} fill="var(--sun)" />
      <rect x={0} y={0} width={W} height={H} fill="transparent" />
    </svg>
    </div>
  );
}
