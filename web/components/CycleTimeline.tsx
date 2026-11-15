"use client";

import { useMemo, useState } from "react";
import type { Results } from "@/lib/types";
import { pct } from "@/lib/format";
import { useWidth } from "@/lib/useWidth";

type Month = { key: string; m: number; x: number; drops: number[]; median: number | null };

const median = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};

/** Every M and X flare of the cycle by month, with the median measured drop per month. */
export default function CycleTimeline({ res }: { res: Results }) {
  const [ref, w] = useWidth<HTMLDivElement>(900);
  const [hi, setHi] = useState<number | null>(null);

  const months = useMemo<Month[]>(() => {
    const by = new Map<string, Month>();
    const first = res.flare_list.first_peak.slice(0, 7);
    const last = res.flare_list.last_peak.slice(0, 7);
    let [y, m] = first.split("-").map(Number);
    const [ly, lm] = last.split("-").map(Number);
    while (y < ly || (y === ly && m <= lm)) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      by.set(key, { key, m: 0, x: 0, drops: [], median: null });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    for (const f of res.event_study.flares) {
      const row = by.get(f.peak.slice(0, 7));
      if (!row) continue;
      if (f.cls.startsWith("X")) row.x += 1;
      else row.m += 1;
      if (f.status === "ok" && f.drop != null) row.drops.push(f.drop);
    }
    const out = [...by.values()];
    for (const r of out) r.median = r.drops.length >= 3 ? median(r.drops) : null;
    return out;
  }, [res]);

  const narrow = w < 640;
  const ml = narrow ? 34 : 44;
  const mr = 10;
  const top1 = 8;
  const h1 = narrow ? 110 : 140;
  const gap = 26;
  const h2 = narrow ? 80 : 100;
  const H = top1 + h1 + gap + h2 + 24;
  const iw = w - ml - mr;
  const bw = iw / months.length;
  const maxN = Math.max(...months.map((d) => d.m + d.x), 1);
  const yN = (v: number) => top1 + h1 - (v / maxN) * h1;
  const dLo = -0.1;
  const dHi = 0.4;
  const top2 = top1 + h1 + gap;
  const yD = (v: number) => top2 + h2 - ((Math.max(dLo, Math.min(dHi, v)) - dLo) / (dHi - dLo)) * h2;
  const placebo = res.event_study.placebo.median;
  const nTicks = Math.ceil(maxN / 50) * 50;
  const nStep = nTicks > 100 ? 50 : 25;

  const line = months
    .map((d, i) => (d.median == null ? null : `${ml + (i + 0.5) * bw},${yD(d.median)}`))
    .reduce<string[][]>((acc, p) => {
      if (p == null) acc.push([]);
      else acc[acc.length - 1].push(p);
      return acc;
    }, [[]])
    .filter((seg) => seg.length > 1)
    .map((seg) => `M${seg.join("L")}`)
    .join("");

  const h = hi == null ? null : months[hi];
  const years = months.map((d, i) => ({ d, i })).filter(({ d }) => d.key.endsWith("-01"));

  return (
    <div ref={ref} className="chart cycle">
      <svg
        width={w}
        height={H}
        role="img"
        aria-label="Monthly count of M and X flares across solar cycle 25, with the median sunlit drop per month"
        onMouseLeave={() => setHi(null)}
      >
        <g className="grid">
          {Array.from({ length: nTicks / nStep + 1 }, (_, k) => k * nStep)
            .filter((v) => v <= maxN)
            .map((v) => (
              <line key={v} x1={ml} x2={w - mr} y1={yN(v)} y2={yN(v)} />
            ))}
        </g>
        <g className="axis">
          {Array.from({ length: nTicks / nStep + 1 }, (_, k) => k * nStep)
            .filter((v) => v <= maxN)
            .map((v) => (
              <text key={v} x={ml - 6} y={yN(v) + 3} textAnchor="end">
                {v}
              </text>
            ))}
          <text x={ml} y={top1 + 2} dx={4} className="title-sm-svg">
            flares per month
          </text>
        </g>
        {months.map((d, i) => (
          <g key={d.key}>
            <rect x={ml + i * bw + 0.5} width={Math.max(1, bw - 1)} y={yN(d.m)} height={top1 + h1 - yN(d.m)} fill="var(--rule-strong)" opacity={hi == null || hi === i ? 1 : 0.55} />
            <rect x={ml + i * bw + 0.5} width={Math.max(1, bw - 1)} y={yN(d.m + d.x)} height={yN(d.m) - yN(d.m + d.x)} fill="var(--sun)" opacity={hi == null || hi === i ? 1 : 0.55} />
            <rect x={ml + i * bw} width={bw} y={top1} height={H - top1 - 20} fill="transparent" onMouseEnter={() => setHi(i)} onClick={() => setHi(i)} />
          </g>
        ))}

        <g className="grid">
          {[0, 0.2, 0.4].map((v) => (
            <line key={v} x1={ml} x2={w - mr} y1={yD(v)} y2={yD(v)} />
          ))}
        </g>
        <g className="axis">
          {[0, 0.2, 0.4].map((v) => (
            <text key={v} x={ml - 6} y={yD(v) + 3} textAnchor="end">
              {Math.round(v * 100)}%
            </text>
          ))}
          <text x={ml} y={top2 - 6} dx={4} className="title-sm-svg">
            typical daytime signals lost after a flare that month
          </text>
        </g>
        {placebo != null && (
          <g>
            <line x1={ml} x2={w - mr} y1={yD(placebo)} y2={yD(placebo)} stroke="var(--night)" strokeDasharray="3 3" />
            <text x={w - mr} y={yD(placebo) - 4} textAnchor="end" className="lbl lbl-night">
              no flare: {pct(placebo)}
            </text>
          </g>
        )}
        <path d={line} fill="none" stroke="var(--sun)" strokeWidth={1.4} />
        {months.map((d, i) =>
          d.median == null ? null : <circle key={d.key} cx={ml + (i + 0.5) * bw} cy={yD(d.median)} r={hi === i ? 3.5 : 2} fill="var(--sun)" />,
        )}

        <g className="axis">
          {years.map(({ d, i }) => (
            <g key={d.key}>
              <line x1={ml + i * bw} x2={ml + i * bw} y1={top1} y2={H - 18} stroke="var(--rule)" />
              <text x={ml + i * bw + 3} y={H - 4}>
                {d.key.slice(0, 4)}
              </text>
            </g>
          ))}
        </g>
        {hi != null && <line x1={ml + (hi + 0.5) * bw} x2={ml + (hi + 0.5) * bw} y1={top1} y2={H - 18} stroke="var(--ink)" strokeWidth={0.6} />}
      </svg>
      <p className="cycle-readout mono" aria-live="polite">
        {h ? (
          <>
            <b>{h.key}</b> · {h.m} M class, <span style={{ color: "var(--sun-ink)" }}>{h.x} X class</span> · typical loss{" "}
            {h.median == null ? "not shown (fewer than 3 measured)" : pct(h.median)} from {h.drops.length} measured
          </>
        ) : (
          <>
            <i className="sw" style={{ background: "var(--rule-strong)" }} /> M class (strong){" "}
            <i className="sw" style={{ background: "var(--sun)" }} /> X class (biggest) · hover or tap a month
          </>
        )}
      </p>
    </div>
  );
}
