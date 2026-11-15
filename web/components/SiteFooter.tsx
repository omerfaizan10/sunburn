import { AUTHOR } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="colophon">
      <p className="credit">
        Built by{" "}
        <a href={AUTHOR.url} rel="author">
          {AUTHOR.name}
        </a>
        {" / "}
        <a href={AUTHOR.url}>Portfolio</a>
        {AUTHOR.email && (
          <>
            {" / "}
            <a href={`mailto:${AUTHOR.email}`}>{AUTHOR.email}</a>
          </>
        )}
      </p>
      <div>
        <b>Data.</b> WSPR spots from wspr.live, a public ClickHouse mirror of
        the WSPRnet database, aggregated on their server into 2-minute counts by
        band and zenith angle. Flare times and classes from NOAA NCEI GOES-R XRS
        L2 flare summary (GOES-16 to 2025-04-07, GOES-19 after). X-ray flux from
        the matching 1-minute averages.
      </div>
      <div>
        <b>Prior work.</b> Frissell and colleagues in HamSCI have published
        flare-driven fade-outs in amateur radio spot data, including WSPR and
        the Reverse Beacon Network. This project repeats that kind of
        measurement for every M and X flare of cycle 25 and adds a blind
        detector with a held-out score.
      </div>
    </footer>
  );
}
