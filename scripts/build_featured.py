"""Per-flare data for the map and the band curves (the 20 largest analysed flares).

For each featured flare writes web/public/data/flares/<id>.json with:
  goes:    1-minute GOES XRS-B flux, peak - 90 min to peak + 120 min
  frames:  2-minute WSPR cycles from peak - 60 to peak + 90 min, each with the
           subsolar point (solar.py) and the indices of tracked paths heard
  paths:   4-character grid pairs on 40/30/20 m heard in at least 4 of the
           cycles in the hour before flare start (the "regulars"), capped at 900
  curves:  per band, event/baseline ratio on sunlit and dark paths, normalized
           to the pre-flare hour, 6-minute trailing sums
and web/public/data/featured.json listing them.
Needs network for the path queries (wspr.live) and GOES files (NCEI); both cached.
Usage: .venv/bin/python scripts/build_featured.py [--n 20]
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import polars as pl

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from sunburn import events, goes, wspr  # noqa: E402
from sunburn.flares import load_flares  # noqa: E402
from sunburn.solar import subsolar_point  # noqa: E402
from run_eval import pre_contaminated  # noqa: E402

OUT = ROOT / "web" / "public" / "data"
FRAME_LO, FRAME_HI = -60, 90
MAX_PATHS = 900
MIN_PRE_BINS = 4


def naive(t: datetime) -> datetime:
    return t.astimezone(timezone.utc).replace(tzinfo=None)


def ratio_curves(cv: pl.DataFrame, start_rel: int) -> dict:
    out = {}
    for b in wspr.HF_BANDS:
        band = {}
        for lit in (True, False):
            c = cv.filter((pl.col("band") == b) & (pl.col("lit") == lit)).sort("rel_min")
            if c.height == 0:
                band["lit" if lit else "dark"] = None
                continue
            rel = c["rel_min"].to_numpy()
            n = c["n"].to_numpy().astype(float)
            base = c["base"].to_numpy().astype(float)
            pre = (rel >= start_rel - 60) & (rel < start_rel)
            pre_ratio = n[pre].sum() / base[pre].sum() if base[pre].sum() > 0 else np.nan
            k = 3
            ns = np.convolve(n, np.ones(k), "full")[: len(n)]
            bs = np.convolve(base, np.ones(k), "full")[: len(n)]
            with np.errstate(all="ignore"):
                y = (ns / bs) / pre_ratio
            keep = (rel >= -60) & (rel <= 120)
            pts = [[int(r_), (None if (not np.isfinite(v) or bb < 15) else round(float(v), 3))]
                   for r_, v, bb in zip(rel[keep], y[keep], bs[keep])]
            band["lit" if lit else "dark"] = {"pre_base": round(float(base[pre].sum()), 1), "pts": pts}
        out[str(b)] = band
    return out


def build_one(f: dict, mx_peaks) -> dict | None:
    peak, start = naive(f["peak"]), naive(f["start"])
    res = events.analyse(peak, start, mx_peaks)
    if res is None or res["low_hf"]["drop"] is None:
        return None
    # GOES flux
    gt, gf = goes.flux(peak - timedelta(minutes=90), peak + timedelta(minutes=120))
    g = [[int((t - peak).total_seconds() // 60), (None if not np.isfinite(v) else float(f"{v:.3e}"))] for t, v in zip(gt, gf)]
    # paths
    t0 = min(start - timedelta(minutes=60), peak + timedelta(minutes=FRAME_LO))
    t1 = peak + timedelta(minutes=FRAME_HI)
    p = wspr.run(wspr.paths_query(t0, t1), f"paths_{f['flare_id']}")
    p = p.with_columns(pl.col("t").cast(pl.Int64))
    ts_start = int(start.replace(tzinfo=timezone.utc).timestamp())
    pre = p.filter((pl.col("t") >= ts_start - 3600) & (pl.col("t") < ts_start))
    reg = (
        pre.group_by("band", "tx", "rx")
        .agg(pl.col("t").n_unique().alias("bins"), pl.col("tx_lat").first(), pl.col("tx_lon").first(),
             pl.col("rx_lat").first(), pl.col("rx_lon").first())
        .filter((pl.col("bins") >= MIN_PRE_BINS) & (pl.col("tx") != pl.col("rx")))
        .sort(["bins", "band", "tx", "rx"], descending=[True, False, False, False])
        .head(MAX_PATHS)
        .with_row_index("idx")
    )
    paths = [[int(r["band"]), round(r["tx_lat"], 2), round(r["tx_lon"], 2), round(r["rx_lat"], 2), round(r["rx_lon"], 2)]
             for r in reg.iter_rows(named=True)]
    heard = p.join(reg.select("band", "tx", "rx", "idx"), on=["band", "tx", "rx"], how="inner")
    by_t = {int(t): sorted(int(i) for i in g_["idx"]) for (t,), g_ in heard.group_by("t")}
    ts_peak = int(peak.replace(tzinfo=timezone.utc).timestamp())
    frames = []
    for rel in range(FRAME_LO, FRAME_HI, 2):
        tt = (ts_peak + rel * 60) // 120 * 120
        dt = datetime.fromtimestamp(tt + 60, tz=timezone.utc)  # cycle midpoint for the Sun position
        slat, slon = subsolar_point(dt)
        frames.append({"t": tt, "rel": round((tt - ts_peak) / 60, 1), "sun": [round(slat, 3), round(slon, 3)],
                       "on": by_t.get(tt, [])})
    # sunlit / dark spot counts on 40/30/20 m per frame, with the quiet-day median
    cv = res["curves"].filter(pl.col("band").is_in(list(events.LOW_HF)))
    agg = cv.group_by("lit", "rel_min").agg(pl.col("n").sum(), pl.col("base").sum())
    look = {(bool(r_["lit"]), int(r_["rel_min"])): (int(r_["n"]), float(r_["base"])) for r_ in agg.iter_rows(named=True)}
    for fr in frames:
        rel_bin = int((fr["t"] - ts_peak) // 60)
        nl, bl = look.get((True, rel_bin), (0, 0.0))
        nd, bd = look.get((False, rel_bin), (0, 0.0))
        fr["spots"] = [nl, round(bl, 1), nd, round(bd, 1)]
    lo = res["low_hf"]
    return {
        "id": str(f["flare_id"]), "cls": f["cls"], "r": int(f["r"]),
        "start": start.strftime("%Y-%m-%dT%H:%M"), "peak": peak.strftime("%Y-%m-%dT%H:%M"),
        "end": naive(f["end"]).strftime("%Y-%m-%dT%H:%M"),
        "start_rel": res["start_rel"], "end_rel": int((naive(f["end"]) - peak).total_seconds() // 60),
        "baseline_days": res["offsets"],
        "drop": round(lo["drop"], 4), "S_lit": round(lo["S_lit"], 4), "S_dark": round(lo["S_dark"], 4),
        "band_drop": {str(b): (None if v["drop"] is None else round(v["drop"], 4)) for b, v in res["bands"].items()},
        "goes": g, "paths": paths, "frames": frames, "curves": ratio_curves(res["curves"], res["start_rel"]),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20)
    a = ap.parse_args()
    fl = load_flares()
    mx_peaks = fl.filter(pl.col("class_flux") >= 1e-5)["peak"].to_list()
    (OUT / "flares").mkdir(parents=True, exist_ok=True)
    index = []
    dirty = pre_contaminated(fl.filter(pl.col("class_flux") >= 1e-5))
    for f in fl.sort("class_flux", descending=True).iter_rows(named=True):
        if len(index) >= a.n:
            break
        if f["flare_id"] in dirty:
            print("skip (pre-flare hour overlaps an earlier M/X flare)", f["cls"], f["peak"], flush=True)
            continue
        d = build_one(f, mx_peaks)
        if d is None:
            print("skip", f["cls"], f["peak"], flush=True)
            continue
        (OUT / "flares" / f"{d['id']}.json").write_text(json.dumps(d, separators=(",", ":")))
        index.append({k: d[k] for k in ("id", "cls", "r", "start", "peak", "end", "drop")} | {"n_paths": len(d["paths"])})
        print(f"{d['cls']:>5} {d['peak']} drop={d['drop']:.2f} paths={len(d['paths'])}", flush=True)
    (OUT / "featured.json").write_text(json.dumps(index, separators=(",", ":")))


if __name__ == "__main__":
    main()
