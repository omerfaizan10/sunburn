import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import Methodology from "@/components/Methodology";
import { FlareDiagram, MeasureDiagram, PipelineDiagram, WsprDiagram } from "@/components/Diagrams";
import type { Results } from "@/lib/types";
import { pct } from "@/lib/format";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "What a solar flare does to shortwave radio, what WSPR is, how Sunburn measures a fade-out on every M and X flare, how it checks the effect is real, and how its blind detector is graded.",
  alternates: { canonical: "/how-it-works/" },
};

function load(): Results {
  return JSON.parse(readFileSync(path.join(process.cwd(), "public", "data", "results.json"), "utf8"));
}

export default function HowItWorks() {
  const res = load();
  const es = res.event_study;
  const det = res.detector;
  const bin = (label: string) => es.dose.bins.find((b) => b.label === label);
  const x2 = bin("X2 and above");
  const m1 = bin("M1 to M2");
  const all = det.holdout;
  const r2 = det.r2_holdout;
  const slope = es.dose.slope_per_decade != null ? (es.dose.slope_per_decade * 100).toFixed(1) : "n/a";
  const ci = es.dose.ci95.map((v) => (v != null ? (v * 100).toFixed(1) : "n/a"));
  const spots = (res.coverage.total_spots / 1e9).toFixed(1);
  const perDay = (res.coverage.mean_spots_per_day / 1e6).toFixed(1);
  const f80 = es.frequency["3"]?.x.median;
  const f10 = es.frequency["28"]?.x.median;

  return (
    <main className="explainer">
      <header className="mast">
        <div>
          <h1>How it works</h1>
          <p className="dek">
            What a solar flare does to radio, how I measured it on{" "}
            {es.n_flares.toLocaleString()} flares, and how I checked that the
            effect is real. No radio background needed.
          </p>
        </div>
        <div className="issue">
          <Link href="/">Back to the dashboard</Link>
        </div>
      </header>

      <section className="section ex">
        <div className="section-head">
          <span className="no">1</span>
          <h2>What a flare does to shortwave radio</h2>
        </div>
        <div className="ex-cols">
          <div className="prose">
            <p>
              Shortwave radio travels around the world by bouncing off the
              ionosphere, a layer of charged gas 60 to several hundred km up. That
              is how a 5-watt transmitter in Germany can be heard in the United
              States.
            </p>
            <p>
              A solar flare is a sudden burst of X-rays from the Sun. They arrive
              in about eight minutes, at the speed of light, and only on the side
              of the Earth facing the Sun. There they supercharge the lowest
              layer, the D layer. Instead of letting signals pass up to the
              reflecting layer and back, it absorbs them. For a few minutes to an
              hour, long-distance radio on the day side goes quiet. The night side
              never sees the X-rays, so its radio carries on.
            </p>
            <p>
              Radio operators call this a shortwave fade-out. NOAA rates the
              strongest ones as R1 to R5 radio blackouts. Sunburn measures how big
              the fade-out is for every M and X class flare of the current solar
              cycle.
            </p>
          </div>
          <figure className="diagram">
            <FlareDiagram />
            <figcaption>
              <span className="fig">Diagram 1</span>
              X-rays thicken the D layer on the day side, which absorbs the
              signal. At night it still reaches the F layer and comes back down.
              Not to scale.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="section ex">
        <div className="section-head">
          <span className="no">2</span>
          <h2>The listening network: WSPR</h2>
        </div>
        <div className="ex-cols">
          <div className="prose">
            <p>
              WSPR (said &ldquo;whisper&rdquo;) is a network of amateur radio
              stations that send tiny test signals in 2-minute slots, around the
              clock. Every time a station decodes one, it uploads a
              &ldquo;spot&rdquo;: who heard whom, on which band, and how strongly.
            </p>
            <p>
              That makes WSPR a planet-wide record of which radio paths were open,
              minute by minute. The record I used covers{" "}
              {res.coverage.n_days.toLocaleString()} days and{" "}
              <b className="num">{spots} billion</b> spots, about {perDay} million
              a day. A fade-out shows up as spots that should have been there and
              were not.
            </p>
          </div>
          <figure className="diagram">
            <WsprDiagram />
            <figcaption>
              <span className="fig">Diagram 2</span>
              Each decoded signal becomes one spot in a public database.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="section ex">
        <div className="section-head">
          <span className="no">3</span>
          <h2>How I measure a fade-out</h2>
        </div>
        <figure className="diagram wide">
          <MeasureDiagram />
        </figure>
        <div className="prose narrow">
          <p>
            Fewer spots on its own means little: how many stations are on the
            air changes with the time of day and the season, and the network has
            grown over the years. So for each flare I compare like with like, in
            four steps.
          </p>
          <ol>
            <li>
              <b>Count</b> spots every 2 minutes on the 40, 30 and 20 m bands,
              split into sunlit paths (the Sun is up at the path&apos;s midpoint)
              and dark paths.
            </li>
            <li>
              <b>Divide by quiet days</b>: the same clock minutes on the ten
              nearest days that had no big flare near that time. This removes the
              daily and seasonal rhythm.
            </li>
            <li>
              <b>Compare after with before</b>: the 30 minutes from the flare&apos;s
              peak against the hour before it started.
            </li>
            <li>
              <b>Subtract the dark side.</b> If spots fell everywhere, something
              else happened, like an upload outage or a geomagnetic storm. Only the
              extra loss on the sunlit side counts as the flare&apos;s drop.
            </li>
          </ol>
          <p>
            The dashboard&apos;s map replays this for the 20 largest flares,
            path by path, with the counts underneath.
          </p>
        </div>
      </section>

      <section className="section ex">
        <div className="section-head">
          <span className="no">4</span>
          <h2>How I know the effect is real</h2>
        </div>
        <div className="prose narrow">
          <p>Three checks, each on the dashboard:</p>
          <ul>
            <li>
              <b>Bigger flares, bigger drops.</b> M1 flares cost a median{" "}
              {pct(m1?.median)} of sunlit spots; X2 and larger cost{" "}
              <b className="num">{pct(x2?.median)}</b>. Each tenfold increase in
              X-ray strength adds about <span className="num">{slope}</span>{" "}
              percentage points (95% interval {ci[0]} to {ci[1]}).
            </li>
            <li>
              <b>Nothing happens without a flare.</b> I ran the exact same
              measurement at {es.placebo.n} random times with no flare. The median
              &ldquo;drop&rdquo; was {pct(es.placebo.median)}, and only{" "}
              {pct(es.placebo.share_ge_x_median, 1)} of them dropped as much as a
              typical X flare.
            </li>
            <li>
              <b>The physics shows up.</b> Absorption should hit low frequencies
              hardest. For X flares the median drop is {pct(f80)} on 80 m and{" "}
              {pct(f10)} on 10 m, falling steadily in between.
            </li>
          </ul>
          <p>
            I excluded {es.n_pre_overlap.toLocaleString()} flares that came within
            an hour of another big flare, because their &ldquo;before&rdquo;
            window was already disturbed. That left{" "}
            {es.n_analysed.toLocaleString()} cleanly measured flares.
          </p>
        </div>
      </section>

      <section className="section ex">
        <div className="section-head">
          <span className="no">5</span>
          <h2>Could you spot flares from radio alone?</h2>
        </div>
        <div className="prose narrow">
          <p>
            To test that, I built a detector that sees only WSPR counts: no X-ray
            data and no flare list. It raises an alarm when the sunlit side
            suddenly falls relative to the dark side. I chose its settings on 2024
            and then scored it once on {det.holdout_period[0]} to{" "}
            {det.holdout_period[1]}, a period it had never seen, against
            NOAA&apos;s flare list.
          </p>
          <table className="data ex-table">
            <thead>
              <tr>
                <th>Held-out score</th>
                <th className="num">Flares found</th>
                <th className="num">Alarms that were right</th>
                <th className="num">Typical delay</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Strong flares (R2 and up)</td>
                <td className="num">{pct(r2.recall)} ({r2.tp} of {r2.tp + r2.fn})</td>
                <td className="num">{pct(r2.precision)}</td>
                <td className="num">{Math.round(r2.median_delay_min ?? 0)} min</td>
              </tr>
              <tr>
                <td>Every M1+ flare</td>
                <td className="num">{pct(all.recall)} ({all.tp} of {all.tp + all.fn})</td>
                <td className="num">{pct(all.precision)}</td>
                <td className="num">{Math.round(all.median_delay_min ?? 0)} min</td>
              </tr>
            </tbody>
          </table>
          <p>
            Honestly: it finds about half of the strong flares that actually
            disrupt radio, but as a general flare alarm it is weak, and most small
            flares leave no clear mark in spot counts. I kept the 2024 settings
            instead of re-tuning on the test period, so these are the numbers it
            would have scored live.
          </p>
        </div>
      </section>

      <section className="section ex">
        <div className="section-head">
          <span className="no">6</span>
          <h2>Where the data comes from</h2>
        </div>
        <figure className="diagram wide">
          <PipelineDiagram />
        </figure>
        <div className="prose narrow">
          <p>
            The heavy lifting happens on wspr.live&apos;s own servers: each query
            groups spots into 2-minute counts by band and by how high the Sun is
            over the path, so billions of rows arrive as a small table. My Python
            code caches every download, builds the baselines, runs the event
            study, the placebo and the detector, and writes the files this site
            reads. Nothing on the page is typed in by hand.
          </p>
        </div>
      </section>

      <section className="section ex">
        <div className="section-head">
          <span className="no">7</span>
          <h2>What could fool it</h2>
        </div>
        <div className="prose narrow">
          <ul>
            <li>
              WSPR stations are mostly in Europe and North America, so a flare at
              03:00 UTC is measured on relatively few sunlit paths.
            </li>
            <li>
              A path counts as sunlit by its midpoint, but a long path crosses
              several regions.
            </li>
            <li>
              WSPR records whether a signal was decoded, not how much it weakened,
              so small losses on strong paths go unseen.
            </li>
            <li>
              wspr.live is missing the first minutes of each hour on{" "}
              {res.coverage.top_of_hour_gap_days} days; those minutes are skipped,
              not filled in.
            </li>
          </ul>
        </div>
      </section>

      <Methodology res={res} no="8" />
    </main>
  );
}
