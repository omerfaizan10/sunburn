// Explainer diagrams, drawn as inline SVG in the report's palette.
// Each one scales to its container; text stays at least 11px at phone width.

const T = { fontFamily: "var(--mono)", fontSize: 11, fill: "var(--ink-2)" } as const;
const TB = { ...T, fill: "var(--ink)", fontWeight: 600 } as const;

/** The Sun's X-rays thicken the D layer on the day side; radio is absorbed there, not at night. */
export function FlareDiagram() {
  // Earth centre and radii
  const cx = 470, cy = 175, r = 96, rd = 112, rf = 142;
  const pt = (deg: number, rad: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`;
  };
  return (
    <svg viewBox="0 0 820 350" width="100%" role="img" aria-label="Diagram: X-rays from a flare reach the day side of the Earth, where the D layer absorbs shortwave radio; on the night side radio still reflects off the higher F layer.">
      {/* Sun and X-rays */}
      <circle cx={70} cy={175} r={42} fill="var(--sun)" />
      <text x={70} y={240} textAnchor="middle" style={TB}>flare</text>
      <text x={70} y={255} textAnchor="middle" style={T}>X-rays, about 8 min</text>
      {[-60, -30, 0, 30, 60].map((dy) => (
        <g key={dy}>
          <line x1={125} y1={175 + dy * 0.6} x2={cx - rf - 14} y2={175 + dy} stroke="var(--sun)" strokeWidth={1.4} strokeDasharray="7 5" />
          <path d={`M${cx - rf - 22},${175 + dy - 4} L${cx - rf - 12},${175 + dy} L${cx - rf - 22},${175 + dy + 4}`} fill="none" stroke="var(--sun)" strokeWidth={1.4} />
        </g>
      ))}
      {/* night half */}
      <path d={`M${cx},${cy - rf - 6} A ${rf + 6} ${rf + 6} 0 0 1 ${cx},${cy + rf + 6} Z`} fill="var(--night-wash)" />
      {/* F layer (both sides) */}
      <circle cx={cx} cy={cy} r={rf} fill="none" stroke="var(--rule-strong)" strokeDasharray="2 4" />
      {/* D layer: thick on the day side during the flare */}
      <path d={`M${cx},${cy - rd} A ${rd} ${rd} 0 0 0 ${cx},${cy + rd}`} fill="none" stroke="var(--sun)" strokeWidth={10} strokeOpacity={0.35} />
      <path d={`M${cx},${cy - rd} A ${rd} ${rd} 0 0 1 ${cx},${cy + rd}`} fill="none" stroke="var(--rule-strong)" strokeWidth={1} />
      {/* Earth */}
      <circle cx={cx} cy={cy} r={r} fill="var(--land)" stroke="var(--coast)" />
      <text x={cx - 48} y={cy + 4} textAnchor="middle" style={TB}>day</text>
      <text x={cx + 48} y={cy + 4} textAnchor="middle" style={TB}>night</text>
      {/* night side radio: leaves the ground, reflects off the F layer, lands again */}
      <path d={`M${pt(-58, r)} L${pt(-29, rf)} L${pt(0, r)}`} fill="none" stroke="var(--night)" strokeWidth={1.6} />
      <circle cx={cx + r} cy={cy} r={3} fill="var(--night)" />
      {/* day side radio: absorbed in the thickened D layer */}
      <path d={`M${pt(-122, r)} L${pt(-122, rd - 4)}`} fill="none" stroke="var(--ink)" strokeWidth={1.6} />
      <path d={`M${pt(-122, rd - 4)} L${pt(-122, rd + 8)}`} fill="none" stroke="var(--ink)" strokeWidth={1.6} strokeDasharray="2 3" />
      <text x={cx - 104} y={cy - 104} textAnchor="end" style={{ ...T, fill: "var(--sun-ink)" }}>absorbed</text>
      {/* labels */}
      <text x={cx + rf + 16} y={cy - 74} style={T}>F layer: reflects</text>
      <text x={cx + rf + 16} y={cy - 60} style={T}>shortwave back down</text>
      <line x1={cx + rf + 12} y1={cy - 66} x2={pt(-29, rf).split(",")[0]} y2={pt(-29, rf).split(",")[1]} stroke="var(--rule-strong)" />
      <text x={150} y={cy + 118} style={T}>D layer, 60 to 90 km:</text>
      <text x={150} y={cy + 132} style={T}>thickens on the day side</text>
      <text x={150} y={cy + 146} style={T}>and soaks up the signal</text>
      <line x1={318} y1={cy + 122} x2={pt(140, rd + 6).split(",")[0]} y2={pt(140, rd + 6).split(",")[1]} stroke="var(--rule-strong)" />
    </svg>
  );
}

/** Two WSPR stations and the record a reception creates. */
export function WsprDiagram() {
  return (
    <svg viewBox="0 0 760 230" width="100%" role="img" aria-label="Diagram: a WSPR transmitter sends a weak 2-minute signal, a distant receiver decodes it and uploads a spot with time, band, both stations and signal strength.">
      {/* ground arc */}
      <path d="M30,170 Q380,120 730,170" fill="none" stroke="var(--coast)" />
      {/* stations */}
      {[{ x: 90, label: "transmitter", sub: "5 W, 2-minute message" }, { x: 670, label: "receiver", sub: "decodes and uploads" }].map((s) => (
        <g key={s.x}>
          <line x1={s.x} y1={160} x2={s.x} y2={110} stroke="var(--ink)" strokeWidth={1.6} />
          <path d={`M${s.x - 12},${116} L${s.x},${104} L${s.x + 12},${116}`} fill="none" stroke="var(--ink)" strokeWidth={1.6} />
          <text x={s.x} y={190} textAnchor="middle" style={TB}>{s.label}</text>
          <text x={s.x} y={205} textAnchor="middle" style={T}>{s.sub}</text>
        </g>
      ))}
      {/* sky-wave hop */}
      <path d="M95,105 L380,28 L665,105" fill="none" stroke="var(--sun)" strokeWidth={1.6} strokeDasharray="7 5" />
      <text x={380} y={20} textAnchor="middle" style={T}>bounces off the ionosphere, thousands of km</text>
      {/* spot card */}
      <g transform="translate(250 70)">
        <rect width={260} height={78} fill="var(--paper)" stroke="var(--ink)" />
        <text x={10} y={18} style={TB}>what one spot records</text>
        <text x={10} y={36} style={T}>time (UTC) · band</text>
        <text x={10} y={52} style={T}>both stations&apos; grid squares</text>
        <text x={10} y={68} style={T}>distance · signal strength (dB)</text>
      </g>
    </svg>
  );
}

/** The measurement in four steps, with schematic curves. */
export function MeasureDiagram() {
  const step = (x: number, n: string, title: string, lines: string[]) => (
    <g transform={`translate(${x} 0)`}>
      <text x={0} y={16} style={{ ...TB, fill: "var(--sun-ink)" }}>{n}</text>
      <text x={16} y={16} style={TB}>{title}</text>
      {lines.map((l, i) => (
        <text key={l} x={0} y={146 + i * 15} style={T}>{l}</text>
      ))}
    </g>
  );
  const box = (x: number) => <rect x={x} y={30} width={160} height={96} fill="none" stroke="var(--rule)" />;
  return (
    <svg viewBox="0 0 760 192" width="100%" role="img" aria-label="Diagram of the four measurement steps: count spots, divide by quiet days, compare with the hour before, subtract the dark side.">
      {box(0)}
      {box(196)}
      {box(392)}
      {box(588)}
      {/* 1: raw counts with a daily wiggle */}
      <path d="M8,70 C40,60 60,90 90,74 S140,60 152,72" fill="none" stroke="var(--sun)" strokeWidth={1.4} />
      <path d="M8,100 C40,96 70,108 100,98 S140,96 152,102" fill="none" stroke="var(--night)" strokeWidth={1.4} />
      {/* 2: flattened against quiet days */}
      <path d="M204,72 L348,72" fill="none" stroke="var(--rule-strong)" strokeDasharray="3 3" />
      <path d="M204,72 L268,72 L280,100 L300,96 L348,78" fill="none" stroke="var(--sun)" strokeWidth={1.4} />
      <path d="M204,90 L348,90" fill="none" stroke="var(--night)" strokeWidth={1.4} />
      {/* 3: before vs after windows */}
      <rect x={400} y={36} width={60} height={84} fill="var(--night-wash)" />
      <rect x={470} y={36} width={60} height={84} fill="var(--sun-wash)" />
      <path d="M400,62 L466,62 L476,96 L530,90 L544,70" fill="none" stroke="var(--sun)" strokeWidth={1.4} />
      <text x={430} y={116} textAnchor="middle" style={T}>before</text>
      <text x={500} y={116} textAnchor="middle" style={T}>after</text>
      {/* 4: net drop */}
      <line x1={620} y1={56} x2={620} y2={104} stroke="var(--sun)" strokeWidth={6} />
      <line x1={660} y1={56} x2={660} y2={62} stroke="var(--night)" strokeWidth={6} />
      <text x={640} y={86} style={{ ...TB, fontSize: 13 }} dx={20}>= drop</text>
      <text x={620} y={118} textAnchor="middle" style={T}>lit</text>
      <text x={660} y={118} textAnchor="middle" style={T}>dark</text>
      {step(0, "1", "count spots", ["every 2 min, sunlit", "and dark paths,", "40, 30 and 20 m"])}
      {step(196, "2", "÷ quiet days", ["same clock minutes", "on ten nearby days", "with no big flare"])}
      {step(392, "3", "after vs before", ["30 min from peak", "against the hour", "before the flare"])}
      {step(588, "4", "net of dark side", ["what hit both sides", "(an upload gap)", "cancels out"])}
    </svg>
  );
}

/** Where the data comes from and how it reaches the page. */
export function PipelineDiagram() {
  const node = (x: number, y: number, w: number, title: string, lines: string[], hot = false) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={22 + lines.length * 15} fill="var(--paper)" stroke={hot ? "var(--sun)" : "var(--ink)"} />
      <text x={10} y={16} style={TB}>{title}</text>
      {lines.map((l, i) => (
        <text key={l} x={10} y={33 + i * 15} style={T}>{l}</text>
      ))}
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-2)" />
      <path d={`M${x2 - 6},${y2 - 4} L${x2},${y2} L${x2 - 6},${y2 + 4}`} fill="none" stroke="var(--ink-2)" />
    </g>
  );
  return (
    <svg viewBox="0 0 760 210" width="100%" role="img" aria-label="Pipeline: wspr.live and NOAA NCEI feed a Python event study and detector, which write results files that the static site reads.">
      {node(0, 10, 190, "wspr.live", ["public ClickHouse mirror", "of the WSPRnet database", "aggregated in SQL there"])}
      {node(0, 110, 190, "NOAA NCEI", ["GOES-R XRS flare summary", "and 1-minute X-ray flux", "GOES-16, then GOES-19"])}
      {arrow(192, 45, 262, 85)}
      {arrow(192, 145, 262, 110)}
      {node(264, 50, 220, "Python pipeline", ["cache every download", "quiet-day baseline", "event study and placebo", "blind detector, grid search", "unit tests (pytest)"], true)}
      {arrow(486, 100, 540, 100)}
      {node(542, 50, 218, "static site", ["results.json, 20 flare files", "Next.js export, no server", "every number from the", "pipeline, none typed in"])}
    </svg>
  );
}
