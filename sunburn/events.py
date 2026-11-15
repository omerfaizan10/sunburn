"""Flare event study on the cached daily WSPR aggregates.

For a flare with peak P and start S, and for each band:

  pre window       [S - 60 min, S)
  response window  [P, P + 30 min)

Event-day counts are compared bin by bin with the quiet-day baseline
(baseline.quiet_days / median over same UTC clock time). With
R = event / baseline summed over a window, the suppression on sunlit paths is
a difference in differences:

  S_lit  = R_lit(response) / R_lit(pre)      (did the sunlit side fall after onset?)
  S_dark = R_dark(response) / R_dark(pre)    (did the dark side, which a flare cannot reach, also fall?)
  drop   = 1 - S_lit / S_dark

Normalizing by the pre window removes day-specific level shifts (a contest,
a missing upload batch); dividing by the dark side removes anything that hit
the whole network at that moment. drop = 0 means no effect, 1 means total
loss of sunlit spots.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from functools import lru_cache

import numpy as np
import polars as pl

from . import wspr
from .baseline import quiet_days

LIT_MAX_ZB = 6  # zenith buckets 0..5 = zenith < 90 deg: path midpoint in daylight
DARK_MIN_ZB = 6  # zenith >= 90 deg
LOW_HF = (7, 10, 14)
PRE = (-60, 0)  # minutes relative to flare start
RESP = (0, 30)  # minutes relative to flare peak
MIN_BASE = 50.0  # baseline spots needed in a window for the band to count


@lru_cache(maxsize=64)
def _read_day(d: date) -> pl.DataFrame:
    return pl.read_parquet(wspr.day_path(d))


def _day(d: date) -> pl.DataFrame | None:
    # missing days are not cached, so a later fetch is picked up
    return _read_day(d) if wspr.day_path(d).exists() else None


def _naive(t: datetime) -> datetime:
    return t.astimezone(timezone.utc).replace(tzinfo=None) if t.tzinfo else t


def window(centre: datetime, lo_min: int, hi_min: int) -> pl.DataFrame | None:
    """Counts with rel_min relative to centre, for [centre+lo, centre+hi). None if any day is missing."""
    c = _naive(centre)
    a, b = c + timedelta(minutes=lo_min), c + timedelta(minutes=hi_min)
    frames = []
    d = a.date()
    while d <= (b - timedelta(seconds=1)).date():
        df = _day(d)
        if df is None:
            return None
        frames.append(df)
        d += timedelta(days=1)
    df = pl.concat(frames)
    ta, tb, tc = (int(x.replace(tzinfo=timezone.utc).timestamp()) for x in (a, b, c))
    return df.filter((pl.col("t") >= ta) & (pl.col("t") < tb)).with_columns(
        ((pl.col("t").cast(pl.Int64) - tc) // 60).cast(pl.Int32).alias("rel_min")
    )


def _classify(df: pl.DataFrame) -> pl.DataFrame:
    return df.with_columns((pl.col("zb") < LIT_MAX_ZB).alias("lit")).group_by("band", "lit", "rel_min").agg(
        pl.col("n").sum()
    )


def stack(peak: datetime, offsets: list[int], lo=-150, hi=150) -> pl.DataFrame | None:
    """Event day (offset 0) plus baseline days, classified lit/dark, rel_min to peak."""
    frames = []
    for d in [0, *offsets]:
        w = window(_naive(peak) + timedelta(days=d), lo, hi)
        if w is None:
            return None
        frames.append(_classify(w).with_columns(pl.lit(d).alias("day_offset")))
    return pl.concat(frames)


def curves(st: pl.DataFrame, offsets: list[int]) -> pl.DataFrame:
    """Per (band, lit, rel_min): event count and median baseline (missing = 0)."""
    keys = st.select("band", "lit", "rel_min").unique()
    days = pl.DataFrame({"day_offset": [0, *offsets]})
    full = keys.join(days, how="cross").join(st, on=["band", "lit", "rel_min", "day_offset"], how="left")
    full = full.with_columns(pl.col("n").fill_null(0))
    base = (
        full.filter(pl.col("day_offset") != 0)
        .group_by("band", "lit", "rel_min")
        .agg(pl.col("n").median().alias("base"))
    )
    ev = full.filter(pl.col("day_offset") == 0).select("band", "lit", "rel_min", "n")
    return base.join(ev, on=["band", "lit", "rel_min"]).sort("band", "lit", "rel_min")


def did_drop(cv: pl.DataFrame, start_rel: int, bands) -> dict:
    """Difference-in-differences drop for a set of bands (summed)."""
    c = cv.filter(pl.col("band").is_in(list(bands)))

    def tot(lit: bool, a: int, b: int) -> tuple[float, float]:
        w = c.filter((pl.col("lit") == lit) & (pl.col("rel_min") >= a) & (pl.col("rel_min") < b))
        return float(w["n"].sum()), float(w["base"].sum())

    pre_a, pre_b = start_rel + PRE[0], start_rel + PRE[1]
    out = {}
    for lit in (True, False):
        en_r, ba_r = tot(lit, *RESP)
        en_p, ba_p = tot(lit, pre_a, pre_b)
        key = "lit" if lit else "dark"
        out[f"{key}_base_resp"] = ba_r
        out[f"{key}_base_pre"] = ba_p
        ok = min(ba_r, ba_p) >= MIN_BASE and en_p > 0
        out[f"S_{key}"] = (en_r / ba_r) / (en_p / ba_p) if ok else None
    if out["S_lit"] is not None and out["S_dark"] not in (None, 0):
        out["drop"] = 1 - out["S_lit"] / out["S_dark"]
    else:
        out["drop"] = None
    return out


def analyse(peak: datetime, start: datetime, all_peaks: list[datetime], k: int = 5) -> dict | None:
    """Full event study for one flare (or placebo time). None if data are missing."""
    offsets = quiet_days(_naive(peak), [_naive(p) for p in all_peaks], k=k, max_search=15)
    st = stack(peak, offsets)
    if st is None:
        return None
    cv = curves(st, offsets)
    start_rel = int(round((_naive(start) - _naive(peak)).total_seconds() / 60))
    res = {"offsets": offsets, "start_rel": start_rel, "low_hf": did_drop(cv, start_rel, LOW_HF)}
    res["bands"] = {int(b): did_drop(cv, start_rel, (b,)) for b in wspr.HF_BANDS}
    res["curves"] = cv
    return res


def bootstrap_slope(x: np.ndarray, y: np.ndarray, n: int = 2000, seed: int = 0) -> tuple[float, float, float]:
    """OLS slope of y on x with a percentile bootstrap 95% interval."""
    rng = np.random.default_rng(seed)
    slope = float(np.polyfit(x, y, 1)[0])
    bs = []
    for _ in range(n):
        i = rng.integers(0, len(x), len(x))
        if np.ptp(x[i]) > 0:
            bs.append(np.polyfit(x[i], y[i], 1)[0])
    lo, hi = np.percentile(bs, [2.5, 97.5])
    return slope, float(lo), float(hi)
