import type { Results } from "@/lib/types";

export default function Methodology({ res, no = "§5" }: { res: Results; no?: string }) {
  const es = res.event_study;
  return (
    <section className="section sheet method">
      <div>
        <div className="section-head">
          <span className="no">{no}</span>
          <h2>Method, and what could fool it</h2>
        </div>
        <ol className="prose">
          <li>
            <b>Flare list.</b> NOAA NCEI&rsquo;s GOES-R XRS flare summary gives
            start, peak, end and class for every flare. GOES-16 is used up to
            2025-04-07 and GOES-19 after, matching which satellite NOAA treated
            as primary, so no flare is counted twice. Cycle 25 here means peaks
            from {res.flare_list.first_peak}: {res.flare_list.n_x} X-class and{" "}
            {res.flare_list.n_m.toLocaleString()} M-class flares. Classes are
            the NCEI science values and can differ by a tenth from the real-time
            SWPC numbers (the 2024-10-03 flare is X8.9 here, X9.0 in SWPC
            bulletins).
          </li>
          <li>
            <b>Spots.</b> Each WSPR spot is reduced on the wspr.live server to
            its 2-minute cycle, band and the solar zenith angle at the
            great-circle midpoint of the path, in 15° steps. The zenith formula
            (NOAA Solar Calculator) runs as SQL there and is unit-tested against
            a Python version in DuckDB. About{" "}
            {(res.coverage.mean_spots_per_day / 1e6).toFixed(1)} million spots a
            day over {res.coverage.n_days.toLocaleString()} days (
            {(res.coverage.total_spots / 1e9).toFixed(1)} billion in all), all
            aggregated before download.
          </li>
          <li>
            <b>Sunlit and dark.</b> A path is sunlit when the Sun is above the
            horizon at its midpoint (zenith below 90°). This is a
            simplification: a long path crosses several regions, and absorption
            happens where the wave passes through the D layer near each end.
          </li>
          <li>
            <b>Baseline.</b> For each flare, the five nearest days on each side
            that had no M or X flare within 3 hours of the same clock time. The
            baseline for each 2-minute cycle is the median across those ten
            days. Same clock time handles the daily cycle; nearby days handle
            season and the slow growth of WSPR.
          </li>
          <li>
            <b>The measured drop.</b> R is flare-day spots over baseline, summed
            over a window. On each side, S = R(peak to peak + 30 min) / R(hour
            before start). Drop = 1 &minus; S<sub>lit</sub> / S<sub>dark</sub>.
            The pre-flare hour absorbs day-specific level shifts, and the dark
            side absorbs anything global.
          </li>
          <li>
            <b>Exclusions.</b> Of {es.n_flares.toLocaleString()} M and X flares,{" "}
            {es.n_pre_overlap.toLocaleString()} had another M or X flare in the
            hour before they started, so their reference hour was already
            suppressed; they are left out of the dose-response.{" "}
            {es.n_thin > 0
              ? `${es.n_thin.toLocaleString()} had fewer than 50 baseline spots on the sunlit or dark side. `
              : "None fell below the 50-spot minimum on either side once 40, 30 and 20 m are pooled. "}
            {es.n_no_data > 0
              ? `${es.n_no_data} fell outside the downloaded days.`
              : ""}
          </li>
          <li>
            <b>Placebo.</b> {es.placebo.n} random times with no M or X flare
            within 3 hours, each treated as a flare starting at that moment and
            peaking 10 minutes later, then measured exactly the same way.
            {es.placebo.share_ge_x_median != null &&
              ` ${(es.placebo.share_ge_x_median * 100).toFixed(1)}% of placebo windows show a drop as large as the median X-class flare.`}
          </li>
          <li>
            <b>Known gaps in the source.</b> On{" "}
            {res.coverage.top_of_hour_gap_days} days, mostly October 2023 to May
            2025, wspr.live holds almost no spots in the first 6 minutes of each
            hour. Because the baseline uses the same clock minutes, the gap
            cancels in the event study; the detector skips those cycles because
            too few spots are expected. {res.coverage.outage_days} days have
            longer outages (more than 20 empty cycles).
          </li>
          <li>
            <b>What could still fool it.</b> Geomagnetic storms hit
            high-latitude paths on both sides, and not evenly, so the dark-side
            correction is imperfect during storms (November 2025 is an example).
            WSPR stations are mostly in Europe and North America, so a flare
            peaking at 03:00 UTC is measured through relatively few sunlit
            paths. And counts measure whether a path was decoded, not how much
            signal was lost.
          </li>
        </ol>
      </div>
      <aside className="margin">
        <div className="mnote">
          <b>Reproduce.</b> <code>make data</code> fetches and caches everything
          (about 2.5 hours at wspr.live&rsquo;s request limit),{" "}
          <code>make eval</code> recomputes every number on this page,{" "}
          <code>make test</code> runs the unit tests for the zenith math,
          baseline and scoring.
        </div>
        <div className="mnote">
          <b>NOAA R scale.</b> R1 M1, R2 M5, R3 X1, R4 X10, R5 X20, by peak 1 to
          8 Å flux.
        </div>
      </aside>
    </section>
  );
}
