"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeaturedItem, FlareDetail, Results } from "@/lib/types";
import { fluxClass, pct, utc } from "@/lib/format";
import FlareMap from "./FlareMap";
import Timeline from "./Timeline";
import BandCurves from "./BandCurves";
import DoseResponse from "./DoseResponse";
import FreqChart from "./FreqChart";
import Scorecard from "./Scorecard";
import CycleTimeline from "./CycleTimeline";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function Dashboard({
  res,
  featured,
  initial,
}: {
  res: Results;
  featured: FeaturedItem[];
  initial: FlareDetail;
}) {
  const [flare, setFlare] = useState<FlareDetail>(initial);
  const [selected, setSelected] = useState(initial.id);
  const [frame, setFrame] = useState(() =>
    initial.frames.findIndex((f) => f.rel >= 4),
  );
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const choose = async (id: string) => {
    setSelected(id);
    setPlaying(false);
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/data/flares/${id}.json`);
      if (!r.ok) throw new Error(String(r.status));
      const d: FlareDetail = await r.json();
      setFlare(d);
      setStarted(false);
      setFrame(
        Math.max(
          0,
          d.frames.findIndex((f) => f.rel >= 4),
        ),
      );
    } catch {
      setError(
        "Could not load this flare's data file. The other figures are unaffected.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setFrame((i) => {
        if (i >= flare.frames.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 260);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, flare]);

  const cur = flare.frames[Math.min(frame, flare.frames.length - 1)];
  const fluxNow = useMemo(() => {
    const m = Math.round(cur.rel + 1);
    let best: number | null = null;
    let bd = Infinity;
    for (const [mm, v] of flare.goes) {
      if (v != null && Math.abs(mm - m) < bd) {
        bd = Math.abs(mm - m);
        best = v;
      }
    }
    return best;
  }, [cur, flare]);

  const es = res.event_study;
  const xBin = es.dose.bins.find((b) => b.label === "X2 and above");
  const m1Bin = es.dose.bins.find((b) => b.label === "M1 to M2");
  const r2 = res.detector.r2_holdout;

  return (
    <main>
      <header className="mast">
        <div>
          <h1>Sunburn</h1>
          <p className="dek">
            What happens to shortwave radio on the day side of the Earth in the
            minutes after a solar flare, measured on every M and X flare of
            solar cycle 25. New to this?{" "}
            <Link href="/how-it-works/">Read how it works</Link>.
          </p>
        </div>
        <div className="issue">
          flares {res.flare_list.first_peak} to {res.flare_list.last_peak}
          <br />
          WSPR record {res.coverage.first_day.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")} to{" "}
          {res.coverage.last_day.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")}
          <br />
          all times UTC
        </div>
      </header>

      <section className="kpis" aria-label="Headline figures">
        <div className="kpi">
          <span className="k">Flares measured</span>
          <span className="v num">{es.n_analysed.toLocaleString()}</span>
          <span className="s">
            of {es.n_flares.toLocaleString()} M and X flares ({res.flare_list.n_x} X class)
          </span>
        </div>
        <div className="kpi">
          <span className="k">Radio reports analysed</span>
          <span className="v num">{(res.coverage.total_spots / 1e9).toFixed(1)} bn</span>
          <span className="s">over {res.coverage.n_days.toLocaleString()} days, 2-minute resolution</span>
        </div>
        <div className="kpi hot">
          <span className="k">Daytime radio lost, biggest flares</span>
          <span className="v num">{pct(xBin?.median)}</span>
          <span className="s">
            smallest flares {pct(m1Bin?.median)}; with no flare {pct(es.placebo.median)}
          </span>
        </div>
        <div className="kpi">
          <span className="k">Extra loss, 10× stronger flare</span>
          <span className="v num">
            +{es.dose.slope_per_decade != null ? (es.dose.slope_per_decade * 100).toFixed(1) : "n/a"} pts
          </span>
          <span className="s">
            percentage points; 95% CI {es.dose.ci95[0] != null ? (es.dose.ci95[0] * 100).toFixed(1) : "n/a"} to{" "}
            {es.dose.ci95[1] != null ? (es.dose.ci95[1] * 100).toFixed(1) : "n/a"}
          </span>
        </div>
        <div className="kpi">
          <span className="k">Strong flares spotted by radio alone</span>
          <span className="v num">{pct(r2.recall)}</span>
          <span className="s">
            found on held-out data; {pct(r2.precision)} of alarms right, about {Math.round(r2.median_delay_min ?? 0)} min late
          </span>
        </div>
      </section>

      <p className="lede">
        In the 30 minutes after an X2 or larger flare peaks, WSPR stations on
        sunlit paths heard a median of{" "}
        <b className="num">{pct(xBin?.median)}</b> fewer spots on 40, 30 and 20
        m than on quiet days, after correcting for whatever the dark side of the
        planet did at the same moment. For M1 flares the median drop is{" "}
        <span className="num">{pct(m1Bin?.median)}</span>; at random quiet times
        it is <span className="num">{pct(es.placebo.median)}</span>.
      </p>

      <p className="howto">
        <b>Replay a flare.</b> Each line on the map is a radio link between two
        stations. <span className="k-sun">Orange</span> links are in daylight,{" "}
        <span className="k-night">grey</span> links are at night. Press{" "}
        <i>replay</i> and watch the orange links go silent around the flare
        peak while the grey ones carry on. Pick another flare from the list.
      </p>
      <section className="hero" aria-label="Flare replay">
        <figure>
          <FlareMap flare={flare} frame={frame} fluxNow={fluxNow} />
          <div className="scrub">
            <button
              className="play"
              onClick={() => {
                if (playing) return setPlaying(false);
                // a fresh replay starts from the top of the window
                if (!started || frame >= flare.frames.length - 1) setFrame(0);
                setStarted(true);
                setPlaying(true);
              }}
              aria-label={playing ? "Pause replay" : "Play replay"}
            >
              {playing ? "pause" : "▸ replay the flare"}
            </button>
            <Timeline
              flare={flare}
              frame={frame}
              onFrame={(i) => {
                setPlaying(false);
                setFrame(i);
              }}
            />
          </div>
          <details className="tech">
            <summary>Technical note</summary>
          <figcaption>
            <span className="fig">Fig. 1</span>
            {flare.cls} flare of {utc(flare.peak)} (R{flare.r} radio blackout).
            Each line is a great-circle path between two 4-character Maidenhead
            grid squares on 40, 30 or 20 m that was heard in at least 4 of the
            2-minute WSPR cycles in the hour before the flare began (
            {flare.paths.length} paths). A path is drawn as heard if any station
            decoded it in that cycle. Sunlit means the path midpoint has the Sun
            above the horizon. Shading marks night, with a darker core beyond 6°
            below the horizon. Equal Earth projection.{" "}
            <span className="source">
              Sources: wspr.live (WSPR spots), NOAA NCEI GOES-R XRS L2 1-min
              flux and flare summary.
            </span>
          </figcaption>
          </details>
        </figure>

        <aside className="margin">
          <div className="picker">
            <div className="picker-head">
              <h2>Biggest flares</h2>
              <span className="mono" style={{ fontSize: 11 }}>
                size · peak (UTC) · signals lost
              </span>
            </div>
            {loading && (
              <p className="mono" style={{ fontSize: 12 }}>
                loading…
              </p>
            )}
            {error && <p style={{ color: "var(--sun-ink)" }}>{error}</p>}
            <ol>
              {featured.map((f) => (
                <li key={f.id}>
                  <button
                    aria-pressed={f.id === selected}
                    onClick={() => choose(f.id)}
                  >
                    <span className="cls">{f.cls}</span>
                    <span>{f.peak.replace("T", " ")}</span>
                    <span className="drop">{pct(f.drop)}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p style={{ marginTop: 8 }}>
              The {featured.length} biggest flares that had a quiet hour before
              them. &ldquo;Signals lost&rdquo; is the share of daytime radio
              signals that went missing, beyond any change on the night side.
            </p>
          </div>
          <div className="readout">
            <table>
              <tbody>
                <tr>
                  <td>start</td>
                  <td>{flare.start.slice(11)}</td>
                </tr>
                <tr>
                  <td>peak</td>
                  <td>{flare.peak.slice(11)}</td>
                </tr>
                <tr>
                  <td>end</td>
                  <td>{flare.end.slice(11)}</td>
                </tr>
                <tr>
                  <td>X-ray level now</td>
                  <td>{fluxClass(fluxNow)}</td>
                </tr>
                <tr>
                  <td>daytime signals vs normal</td>
                  <td>{flare.S_lit.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>nighttime signals vs normal</td>
                  <td>{flare.S_dark.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>daytime signals lost</td>
                  <td style={{ color: "var(--sun-ink)" }}>{pct(flare.drop)}</td>
                </tr>
                <tr>
                  <td>normal days compared</td>
                  <td>
                    {flare.baseline_days
                      .map((d) => (d > 0 ? `+${d}` : `${d}`))
                      .join(" ")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </aside>
      </section>

      <section className="section sheet">
        <div className="full">
          <div className="section-head">
            <span className="no">§0</span>
            <h2>Every month of the solar cycle, flares cost daytime radio</h2>
          </div>
          <p className="howto">
            <b>Top:</b> how many flares happened each month (
            <span className="k-sun">orange</span> = the biggest, X class).{" "}
            <b>Bottom:</b> the typical share of daytime radio signals lost after
            a flare that month. The dashed line is what the same measurement
            gives with no flare at all.
          </p>
          <CycleTimeline res={res} />
          <details className="tech">
            <summary>Technical note</summary>
          <figcaption>
            <span className="fig">Fig. 0</span>
            Every M and X flare in NOAA&apos;s GOES flare list by month of peak
            ({es.n_flares.toLocaleString()} flares). Lower panel: median sunlit
            drop on 40+30+20 m, net of the dark side, for months with at least 3
            cleanly measured flares; the dashed line is the median of{" "}
            {es.placebo.n} random quiet times.
          </figcaption>
          </details>
        </div>
      </section>

      <section className="section sheet">
        <div>
          <div className="section-head">
            <span className="no">§1</span>
            <h2>The same flare, on each radio band</h2>
          </div>
          <p className="howto">
            Each small chart is one radio band, from low frequency (80 m, top
            left) to high (10 m, bottom right).{" "}
            <span className="k-sun">Orange</span> is daytime signals,{" "}
            <span className="k-night">grey</span> is nighttime; &ldquo;normal&rdquo;
            is a typical day. An orange dip in the shaded flare window is the
            blackout.
          </p>
          <BandCurves flare={flare} />
          <details className="tech">
            <summary>Technical note</summary>
          <figcaption>
            <span className="fig">Fig. 2</span>
            Spots heard on the flare day divided by the median of the same UTC
            minutes on quiet days, then scaled so the hour before the flare
            equals 1.0. 6-minute trailing sums.
            <span style={{ color: "var(--sun-ink)" }}> Sunlit</span> paths
            against <span style={{ color: "var(--night)" }}>dark</span> paths;
            the shaded band is the GOES flare interval.
          </figcaption>
          </details>
        </div>
        <aside className="margin">
          <div className="mnote">
            <b>Why the low bands fall hardest.</b> The X-rays energise a layer of
            the atmosphere about 60 to 90 km up, and that layer soaks up low
            radio frequencies more than high ones. So 80 m and 40 m should fade
            the most. The higher bands drop too, just less.
          </div>
          <div className="mnote">
            <b>Why compare with nighttime.</b> Links on the night side never see
            the X-rays. If they drop too, something else happened (a data
            outage, a radio contest, a magnetic storm), so I take that part out
            and count only the extra loss in daylight.
          </div>
        </aside>
      </section>

      <section className="section sheet">
        <div className="full">
          <div className="section-head">
            <span className="no">§2</span>
            <h2>Bigger flares knock out more radio</h2>
          </div>
          <p className="howto">
            Each dot is one flare: further right means a stronger flare, higher
            up means more daytime radio was lost. The{" "}
            <span className="k-sun">orange bars</span> show the typical loss for
            each size. The grey strip on the left is the same measurement at
            random moments with no flare, and it sits around zero.
          </p>
          <DoseResponse res={res} selectedId={selected} />
          <details className="tech">
            <summary>Technical note</summary>
          <figcaption>
            <span className="fig">Fig. 3</span>
            Each dot is one flare ({es.n_analysed.toLocaleString()} M and X
            flares with enough sunlit and dark coverage and a quiet pre-flare
            hour). Orange bars: median and interquartile range per class band.
            Left strip: {es.placebo.n} random times with no M or X flare within
            3 hours, scored identically. A least-squares fit gives{" "}
            <span className="num">
              {es.dose.slope_per_decade != null
                ? `${(es.dose.slope_per_decade * 100).toFixed(1)}`
                : "n/a"}
            </span>{" "}
            percentage points of extra drop per tenfold increase in peak flux
            (95% bootstrap interval{" "}
            <span className="num">
              {es.dose.ci95[0] != null
                ? (es.dose.ci95[0] * 100).toFixed(1)
                : "n/a"}{" "}
              to{" "}
              {es.dose.ci95[1] != null
                ? (es.dose.ci95[1] * 100).toFixed(1)
                : "n/a"}
            </span>
            ). The selected flare is drawn in orange.
          </figcaption>
          </details>
        </div>
      </section>

      <section className="section sheet">
        <div>
          <div className="section-head">
            <span className="no">§3</span>
            <h2>Low frequencies are hit hardest</h2>
          </div>
          <p className="howto">
            For each radio band, the typical share of daytime signals lost. The
            lines slope down to the right: lower frequencies lose the most, which
            is what the physics of the absorbing layer predicts. The dashed line
            is the no-flare comparison.
          </p>
          <FreqChart res={res} />
          <details className="tech">
            <summary>Technical note</summary>
          <figcaption>
            <span className="fig">Fig. 4</span>
            Median drop per band, with interquartile range, for X-class flares,
            M5 to X1 flares and placebo windows. Bands with fewer than 20 usable
            events are left out.
          </figcaption>
          </details>
        </div>
        <aside className="margin">
          <div className="mnote">
            <b>Reading it.</b> For the biggest flares the typical loss goes from{" "}
            <span className="num">{pct(res.event_study.frequency["3"]?.x.median)}</span>{" "}
            on 80 m to <span className="num">{pct(res.event_study.frequency["28"]?.x.median)}</span>{" "}
            on 10 m, and the no-flare line stays near zero on every band. The
            drop shrinks less with frequency than textbook physics suggests,
            probably because these reports only say whether a signal got
            through, not how much weaker it was.
          </div>
        </aside>
      </section>

      <Scorecard res={res} />

    </main>
  );
}
