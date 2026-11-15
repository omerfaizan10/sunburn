import type { DetectorMetrics, Results } from "@/lib/types";
import { pct } from "@/lib/format";

function Row({
  label,
  m,
  strong,
}: {
  label: string;
  m: DetectorMetrics;
  strong?: boolean;
}) {
  return (
    <tr style={strong ? { fontWeight: 600 } : undefined}>
      <td>{label}</td>
      <td className="num">{m.tp + m.fn}</td>
      <td className="num">{m.n_alarms}</td>
      <td className="num">{m.tp}</td>
      <td className="num">{m.fp}</td>
      <td className="num">{m.fn}</td>
      <td className="num">{pct(m.precision, 1)}</td>
      <td className="num">{pct(m.recall, 1)}</td>
      <td className="num">{pct(m.observable_recall, 1)}</td>
      <td className="num">
        {m.median_delay_min != null
          ? `${m.median_delay_min.toFixed(0)} min`
          : "n/a"}
      </td>
    </tr>
  );
}

function Meter({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null;
  detail: string;
}) {
  const v = value ?? 0;
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <b className="num">{pct(value)}</b>
      </div>
      <div className="meter-track" aria-hidden>
        <div
          className="meter-fill"
          style={{ width: `${Math.round(v * 100)}%` }}
        />
      </div>
      <div className="meter-detail">{detail}</div>
    </div>
  );
}

export default function Scorecard({ res }: { res: Results }) {
  const d = res.detector;
  const h = d.holdout;
  const r2 = d.r2_holdout;
  const p = h.params;
  const order = ["R1", "R2", "R3+"];
  const labels: Record<string, string> = {
    R1: "minor (M1 to M5)",
    R2: "moderate (M5 to X1)",
    "R3+": "strong (X1 and up)",
  };
  return (
    <section className="section sheet">
      <div className="full">
        <div className="section-head">
          <span className="no">§4</span>
          <h2>Can radio alone spot a flare? About half of the strong ones</h2>
        </div>
        <p className="howto">
          I built a detector that only listens to the radio data, never the
          satellite, and tested it on {d.holdout_period[0].slice(0, 4)} to{" "}
          {d.holdout_period[1].slice(0, 4)}, a period it had never seen. Longer
          bars are better.
        </p>
        <div className="meters">
          <Meter
            label="Strong flares it caught"
            value={r2.recall}
            detail={`${r2.tp} of ${r2.tp + r2.fn} flares strong enough to disrupt radio (M5 and up)`}
          />
          <Meter
            label="Its alarms that were real"
            value={r2.precision}
            detail={`${r2.tp} of ${r2.n_alarms} alarms matched one of those flares`}
          />
          <Meter
            label="All flares it caught, incl. small"
            value={h.recall}
            detail={`${h.tp} of ${h.tp + h.fn}: most small flares leave no clear mark`}
          />
          <div className="meter">
            <div className="meter-head">
              <span>How late it raises the alarm</span>
              <b className="num">{Math.round(r2.median_delay_min ?? 0)} min</b>
            </div>
            <div className="meter-detail">
              typical time after the flare starts, for strong flares
            </div>
          </div>
        </div>
      </div>
      <details className="tech full">
        <summary>Full scorecard and how the detector works (technical)</summary>
        <div className="sheet tech-body">
          <div>
            <p className="prose">
              The detector sees only WSPR counts: no X-ray data, no flare list.
              Every 2 minutes it compares sunlit 40/30/20 m spots with the same
              minutes over the previous seven days and divides by the same ratio
              for dark paths.
              {p.mode === "sudden"
                ? " That index is then divided by its own median over the preceding hour, so it asks whether the sunlit side just fell, not whether it is low today."
                : ""}{" "}
              It raises an alarm when the result stays below{" "}
              <span className="num">{p.threshold}</span> for{" "}
              <span className="num">{p.min_run}</span> consecutive{" "}
              {p.smooth > 1 ? `${p.smooth * 2}-minute windows` : "cycles"}. All
              settings, including that choice of variant, were picked on{" "}
              {d.tune_period[0].slice(0, 4)} by F1 and frozen before scoring{" "}
              {d.holdout_period[0]} to {d.holdout_period[1]}. It is scored two
              ways: against every NOAA flare of M1 or higher (radio blackout R1
              and up), and against R2 and up only, where alarms on R1 flares
              count neither for nor against it.
            </p>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th className="num">Events</th>
                    <th className="num">Alarms</th>
                    <th className="num">Hit</th>
                    <th className="num">False</th>
                    <th className="num">Missed</th>
                    <th className="num">Precision</th>
                    <th className="num">Recall</th>
                    <th className="num">Recall, observable</th>
                    <th className="num">Median delay</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={10} className="grp">
                      target: R1 and up (M1+)
                    </td>
                  </tr>
                  <Row
                    label={`tuning, ${d.tune_period[0].slice(0, 4)}`}
                    m={d.tune_best}
                  />
                  <Row
                    label={`held out, ${d.holdout_period[0].slice(0, 4)} to ${d.holdout_period[1].slice(0, 7)}`}
                    m={h}
                    strong
                  />
                  <tr className="rule-top">
                    <td colSpan={10} className="grp">
                      target: R2 and up (M5+), R1 alarms neutral
                    </td>
                  </tr>
                  <Row
                    label={`tuning, ${d.tune_period[0].slice(0, 4)}`}
                    m={d.r2_tune_best}
                  />
                  <Row
                    label={`held out, ${d.holdout_period[0].slice(0, 4)} to ${d.holdout_period[1].slice(0, 7)}`}
                    m={d.r2_holdout}
                    strong
                  />
                </tbody>
                <caption>
                  <span
                    className="fig"
                    style={{
                      fontWeight: 600,
                      fontVariantCaps: "all-small-caps",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Table 1
                  </span>{" "}
                  An alarm counts as a hit if it falls between 4 minutes before
                  the GOES start time and 10 minutes after the GOES end time;
                  each flare can be claimed once. Delay runs from GOES start to
                  the end of the WSPR cycle that completed the alarm.
                  &ldquo;Observable&rdquo; keeps only flares whose peak fell
                  when at least {p.min_expected} sunlit and {p.min_expected}{" "}
                  dark spots were expected in the window ({h.observable_n} of{" "}
                  {h.tp + h.fn}); flares at times when the sunlit side holds few
                  WSPR stations cannot be seen by any detector built on these
                  data.
                </caption>
              </table>
            </div>
          </div>
          <aside className="margin">
            <div className="mnote">
              <b>Caught, by how strong the blackout was</b>
              <table className="data" style={{ marginTop: 6, fontSize: 13 }}>
                <tbody>
                  {order
                    .filter((k) => h.recall_by_r[k])
                    .map((k) => {
                      const v = h.recall_by_r[k];
                      const r = v.n ? v.hit / v.n : 0;
                      return (
                        <tr key={k}>
                          <td>{labels[k]}</td>
                          <td className="num" style={{ whiteSpace: "nowrap" }}>
                            {v.hit}/{v.n}
                            <span
                              className="bar-inline"
                              style={{
                                width: `${Math.round(r * 40)}px`,
                                background: "var(--sun)",
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="mnote">
              <b>What a false alarm is here.</b> Any alarm outside a target
              flare window.{" "}
              {h.fp_on_c_flares != null &&
                `In the held-out R1 scoring, ${h.fp_on_c_flares} of the ${h.fp} false alarms fall inside a C-class flare window. C flares do absorb a little, but they are still counted against the detector.`}
            </div>
          </aside>
        </div>
      </details>
    </section>
  );
}
