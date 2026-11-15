"use client";

import { useMemo } from "react";
import {
  geoCircle,
  geoDistance,
  geoEqualEarth,
  geoGraticule,
  geoInterpolate,
  geoPath,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import landTopo from "world-atlas/land-110m.json";
import type { FlareDetail } from "@/lib/types";
import { fluxClass, hhmm, int, signedMin } from "@/lib/format";

const W = 960;
const H = 468;

const projection = geoEqualEarth().fitExtent(
  [
    [6, 6],
    [W - 6, H - 6],
  ],
  { type: "Sphere" },
);
const path = geoPath(projection);
const topo = landTopo as unknown as Topology<{ land: GeometryCollection }>;
const landD = path(feature(topo, topo.objects.land)) ?? "";
const sphereD = path({ type: "Sphere" }) ?? "";
const gratD = path(geoGraticule().step([30, 30])()) ?? "";

export default function FlareMap({
  flare,
  frame,
  fluxNow,
}: {
  flare: FlareDetail;
  frame: number;
  fluxNow: number | null;
}) {
  const arcs = useMemo(
    () =>
      flare.paths.map(([band, tla, tlo, rla, rlo]) => {
        const a: [number, number] = [tlo, tla];
        const b: [number, number] = [rlo, rla];
        return {
          band,
          d: path({ type: "LineString", coordinates: [a, b] }) ?? "",
          mid: geoInterpolate(a, b)(0.5),
        };
      }),
    [flare],
  );

  const f = flare.frames[Math.min(frame, flare.frames.length - 1)];
  const [slat, slon] = f.sun;
  const sun: [number, number] = [slon, slat];
  const night = geoCircle()
    .center([slon + 180, -slat])
    .radius(90)();
  const nightD = path(night) ?? "";
  const twilight = geoCircle()
    .center([slon + 180, -slat])
    .radius(84)();
  const twiD = path(twilight) ?? "";
  const sunXY = projection(sun);
  const heard = new Set(f.on);

  let litOn = 0;
  let litOff = 0;
  let darkOn = 0;
  const items = arcs.map((arc, i) => {
    const lit = geoDistance(arc.mid, sun) < Math.PI / 2;
    const on = heard.has(i);
    if (lit && on) litOn++;
    else if (lit) litOff++;
    else if (on) darkOn++;
    const cls = on
      ? lit
        ? "arc lit"
        : "arc dark"
      : lit
        ? "arc lit-off"
        : "arc dark-off";
    return <path key={i} d={arc.d} className={cls} />;
  });

  const [nl, bl, nd, bd] = f.spots;
  const sourceGap = bl + bd < 40;

  return (
    <div className="mapbox">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`World map at ${hhmm(f.t + 60)} UTC: ${litOn} sunlit and ${darkOn} dark radio paths heard, ${litOff} sunlit paths silent.`}
      >
        <defs>
          <clipPath id="sphere-clip">
            <path d={sphereD} />
          </clipPath>
        </defs>
        <path d={sphereD} fill="var(--sun-wash)" />
        <g clipPath="url(#sphere-clip)">
          <path d={gratD} fill="none" stroke="var(--rule)" strokeWidth={0.6} />
          <path
            d={landD}
            fill="var(--land)"
            stroke="var(--coast)"
            strokeWidth={0.5}
          />
          <path d={nightD} fill="var(--night-wash)" />
          <path d={twiD} fill="var(--night-wash)" />
          <g fill="none" strokeLinecap="round">
            {items}
          </g>
        </g>
        <path
          d={nightD}
          fill="none"
          stroke="var(--night)"
          strokeWidth={0.8}
          strokeDasharray="2 3"
          clipPath="url(#sphere-clip)"
        />
        <path d={sphereD} fill="none" stroke="var(--ink)" strokeWidth={0.8} />
        {sunXY && (
          <g transform={`translate(${sunXY[0]},${sunXY[1]})`} aria-hidden>
            <circle r={9} fill="none" stroke="var(--sun)" strokeWidth={1} />
            <circle r={3.2} fill="var(--sun)" />
          </g>
        )}
      </svg>
      <div className="map-stamp">
        <div className="big">
          {hhmm(f.t)} UTC{" "}
          <span style={{ color: "var(--muted)" }}>
            {Math.round(f.rel) === 0
              ? "flare peak"
              : `${signedMin(Math.round(f.rel))} min from peak`}
          </span>
        </div>
        <div>
          Sun&apos;s X-ray brightness:{" "}
          <b
            style={{
              color: fluxNow && fluxNow >= 1e-5 ? "var(--sun-ink)" : "inherit",
            }}
          >
            {fluxClass(fluxNow)}
          </b>
        </div>
        <div>
          daytime radio links working: <b>{litOn}</b> of {litOn + litOff}
        </div>
        {sourceGap ? (
          <div style={{ color: "var(--muted)" }}>
            data gap: almost no reports were logged this minute
          </div>
        ) : (
          <div style={{ color: "var(--muted)" }}>
            daytime signals heard: {int(nl)} (normally {int(bl)})
          </div>
        )}
      </div>
      <div className="map-legend" aria-hidden>
        <span className="key">
          <i style={{ borderColor: "var(--sun)" }} />
          daytime link working
        </span>
        <span className="key">
          <i
            style={{
              borderColor: "var(--sun)",
              opacity: 0.35,
              borderTopStyle: "dotted",
            }}
          />
          daytime link went silent
        </span>
        <span className="key">
          <i style={{ borderColor: "var(--night)" }} />
          nighttime link (X-rays cannot reach it)
        </span>
      </div>
    </div>
  );
}
