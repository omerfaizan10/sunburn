"use client";

import { useState } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import type { Results } from "@/lib/types";
import { pct } from "@/lib/format";
import { useWidth } from "@/lib/useWidth";

const H = 380;
const M = { l: 80, r: 20, t: 40, b: 48 };
const GAPX = 34;

type Tip = { x: number; y: number; text: string[] } | null;

export default function DoseResponse({
  res,
  selectedId,
}: {
  res: Results;
  selectedId: string | null;
}) {
  const [wrap, W] = useWidth<HTMLDivElement>(960);
  const PW = Math.min(120, Math.round(W * 0.15)); // placebo strip width
  const [tip, setTip] = useState<Tip>(null);
  const es = res.event_study;
  const ok = es.flares.filter((f) => f.status === "ok" && f.drop != null);
  const y = scaleLinear()
    .domain([-0.6, 1])
    .range([H - M.b, M.t])
    .clamp(true);
  const xp0 = M.l;
  const xp1 = M.l + PW;
  const x = scaleLog()
    .domain([1e-5, 1.2e-3])
    .range([xp1 + GAPX, W - M.r]);

  // Deterministic jitter for the placebo strip. Integer hashing (not Math.sin) so the
  // server render and the browser produce identical positions and hydration matches.
  const jitter = (i: number) => (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296;
  const pmed = es.placebo.median;

  const show = (e: React.PointerEvent, text: string[]) =>
    setTip({ x: e.clientX + 12, y: e.clientY + 12, text });

  return (
    <div className="chart" ref={wrap} onPointerLeave={() => setTip(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Share of daytime radio signals lost after each flare, against flare strength, with random no-flare times for comparison"
      >
        <g className="grid">
          {[-0.5, 0, 0.5, 1].map((v) => (
            <line key={v} x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} />
          ))}
        </g>
        <line
          x1={M.l}
          x2={W - M.r}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--rule-strong)"
        />
        <g className="axis">
          {[-0.5, 0, 0.5, 1].map((v) => (
            <text key={v} x={M.l - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {v === 0 ? "no change" : pct(v)}
            </text>
          ))}
          <text
            x={12}
            y={(M.t + H - M.b) / 2}
            transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}
            textAnchor="middle"
            className="lbl"
          >
            daytime radio signals lost
          </text>
          {[
            ["M1", 1e-5],
            ["M2", 2e-5],
            ["M5", 5e-5],
            ["X1", 1e-4],
            ["X2", 2e-4],
            ["X5", 5e-4],
            ["X10", 1e-3],
          ].map(([l, v]) => (
            <g key={l as string}>
              <line
                x1={x(v as number)}
                x2={x(v as number)}
                y1={H - M.b}
                y2={H - M.b + 4}
              />
              <text x={x(v as number)} y={H - M.b + 16} textAnchor="middle">
                {l}
              </text>
            </g>
          ))}
          <text x={W - M.r} y={H - 6} textAnchor="end" className="lbl">
            {W < 640 ? "flare strength →" : "flare strength → (an X1 flare is 10 times an M1, X10 is 100 times)"}
          </text>
          <text x={(xp0 + xp1) / 2} y={H - M.b + 16} textAnchor="middle">
            no flare
          </text>
          <text
            x={(xp0 + xp1) / 2}
            y={H - 6}
            textAnchor="middle"
            className="lbl"
          >
            for comparison
          </text>
        </g>
        <line
          x1={xp1 + GAPX / 2}
          x2={xp1 + GAPX / 2}
          y1={M.t}
          y2={H - M.b}
          stroke="var(--rule)"
        />

        {/* placebo strip */}
        <g>
          {es.placebo.drops.map((d, i) => (
            <circle
              key={i}
              cx={xp0 + 10 + jitter(i) * (PW - 20)}
              cy={y(d)}
              r={2}
              fill="var(--night)"
              fillOpacity={0.45}
            />
          ))}
          {pmed != null && (
            <line
              x1={xp0 + 4}
              x2={xp1 - 4}
              y1={y(pmed)}
              y2={y(pmed)}
              stroke="var(--ink)"
              strokeWidth={2}
            />
          )}
        </g>

        {/* plain-language key (outside .axis so its stroke colours apply) */}
        <g>
          <text x={xp1 + GAPX + 4} y={16} className="lbl" style={{ fill: "var(--ink-2)" }}>
            each dot = one flare
          </text>
          <text x={(xp0 + xp1) / 2} y={16} textAnchor="middle" className="lbl" style={{ fill: "var(--ink-2)" }}>
            no flare
          </text>
          {W >= 640 && (
          <g transform={`translate(${W - M.r - 250} 10)`}>
            <line x1={0} x2={22} y1={6} y2={6} stroke="var(--sun-ink)" strokeWidth={3} />
            <text x={28} y={6} dy="0.32em" className="lbl">typical loss for that size</text>
            <line x1={11} x2={11} y1={14} y2={28} stroke="var(--sun-ink)" strokeWidth={1.5} />
            <text x={28} y={21} dy="0.32em" className="lbl">range of the middle half</text>
          </g>
          )}
        </g>

        {/* flares */}
        <g>
          {ok.map((f) => {
            const sel = f.id === selectedId;
            return (
              <circle
                key={f.id}
                cx={x(Math.min(f.flux, 1.2e-3))}
                cy={y(f.drop as number)}
                r={sel ? 5 : f.flux >= 1e-4 ? 2.8 : 2}
                fill={sel ? "var(--sun)" : "var(--ink)"}
                fillOpacity={sel ? 1 : f.flux >= 1e-4 ? 0.7 : 0.28}
                stroke={sel ? "var(--paper)" : "none"}
                strokeWidth={sel ? 2 : 0}
                onPointerEnter={(e) =>
                  show(e, [
                    `${f.cls}  ${f.peak.replace("T", " ")} UTC`,
                    `${pct(f.drop)} of daytime signals lost`,
                  ])
                }
              />
            );
          })}
        </g>

        {/* class bin medians with interquartile range */}
        <g>
          {es.dose.bins
            .filter((b) => b.n > 0 && b.median != null)
            .map((b) => {
              const xa = x(b.lo);
              const xb = x(Math.min(b.hi, 1.2e-3));
              const xm = (xa + xb) / 2;
              return (
                <g
                  key={b.label}
                  onPointerEnter={(e) =>
                    show(e, [
                      `${b.label} flares`,
                      `typical loss ${pct(b.median)} (middle half ${pct(b.p25)} to ${pct(b.p75)})`,
                      `${b.n.toLocaleString()} flares`,
                    ])
                  }
                >
                  <line
                    x1={xm}
                    x2={xm}
                    y1={y(b.p25 as number)}
                    y2={y(b.p75 as number)}
                    stroke="var(--sun-ink)"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={xa + 6}
                    x2={xb - 6}
                    y1={y(b.median as number)}
                    y2={y(b.median as number)}
                    stroke="var(--sun-ink)"
                    strokeWidth={3}
                  />
                  <rect
                    x={xa}
                    width={xb - xa}
                    y={M.t}
                    height={H - M.t - M.b}
                    fill="transparent"
                  />
                </g>
              );
            })}
        </g>
      </svg>
      {tip && (
        <div className="tip" style={{ left: tip.x, top: tip.y }}>
          {tip.text.map((t, i) => (
            <div key={i}>{t}</div>
          ))}
        </div>
      )}
    </div>
  );
}
