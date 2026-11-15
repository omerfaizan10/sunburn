"""Blind detector: build the continuous series, tune on one period, score on another.

Series (fixed before looking at results):
  n_lit  = spots on 40/30/20 m whose path midpoint has solar zenith < 75 deg
  n_dark = spots on 40/30/20 m whose path midpoint has solar zenith >= 105 deg
The 75 to 105 deg band around the terminator is left out on purpose, since
grey-line propagation behaves differently from either side.

Expected value for a 2-minute bin = median of the same UTC bin on the 7
previous days (causal: no future data, no flare information). Counts and
expectations are summed over a trailing window of `smooth` bins.

An alarm for an onset is raised when the run of low bins completes, i.e. at
the end of bin (onset + min_run - 1), plus the 2-minute WSPR cycle needed
to receive those spots. Delay is alarm time minus GOES flare start.
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone

import numpy as np
import polars as pl

from . import wspr
from .detector import DetectorParams, detect, relative_to_recent, suppression_index
from .flares import class_to_flux, r_scale
from .scoring import Event, score

LOW_HF = (7, 10, 14)
LIT_ZB_MAX = 5  # zenith < 75
DARK_ZB_MIN = 7  # zenith >= 105
BINS_PER_DAY = 720
HISTORY_DAYS = 7


def series(d0: date, d1: date) -> pl.DataFrame:
    """Continuous 2-minute series for [d0, d1], with HISTORY_DAYS of lead-in for the baseline.

    Returns columns t (unix s), n_lit, n_dark, exp_lit, exp_dark; missing days give null rows.
    """
    lead = d0 - timedelta(days=HISTORY_DAYS)
    t_start = int(datetime(lead.year, lead.month, lead.day, tzinfo=timezone.utc).timestamp())
    n_days = (d1 - lead).days + 1
    grid = pl.DataFrame({"t": np.arange(n_days * BINS_PER_DAY, dtype=np.int64) * 120 + t_start})
    frames = []
    d = lead
    while d <= d1:
        p = wspr.day_path(d)
        if p.exists():
            frames.append(pl.read_parquet(p))
        d += timedelta(days=1)
    raw = pl.concat(frames).filter(pl.col("band").is_in(list(LOW_HF)))
    agg = raw.group_by("t").agg(
        pl.col("n").filter(pl.col("zb") < LIT_ZB_MAX).sum().alias("n_lit"),
        pl.col("n").filter(pl.col("zb") >= DARK_ZB_MIN).sum().alias("n_dark"),
    ).with_columns(pl.col("t").cast(pl.Int64), pl.lit(True).alias("have"))
    # A day file that exists contributes zeros for silent bins; a missing day stays null.
    have_days = {int(datetime(f.year, f.month, f.day, tzinfo=timezone.utc).timestamp()) // 86400 for f in _days(lead, d1)}
    s = grid.join(agg, on="t", how="left").with_columns(
        pl.col("t").floordiv(86400).is_in(list(have_days)).alias("day_ok")
    )
    s = s.with_columns(
        pl.when(pl.col("day_ok")).then(pl.col("n_lit").fill_null(0)).otherwise(None).cast(pl.Float64).alias("n_lit"),
        pl.when(pl.col("day_ok")).then(pl.col("n_dark").fill_null(0)).otherwise(None).cast(pl.Float64).alias("n_dark"),
    ).drop("have", "day_ok")
    for col in ("n_lit", "n_dark"):
        arr = s[col].to_numpy().astype(float)
        hist = np.full((HISTORY_DAYS, len(arr)), np.nan)
        for k in range(1, HISTORY_DAYS + 1):
            hist[k - 1, k * BINS_PER_DAY :] = arr[: len(arr) - k * BINS_PER_DAY]
        with np.errstate(all="ignore"):
            exp = np.nanmedian(hist, axis=0)
        s = s.with_columns(pl.Series(col.replace("n_", "exp_"), exp))
    t0 = int(datetime(d0.year, d0.month, d0.day, tzinfo=timezone.utc).timestamp())
    return s.filter(pl.col("t") >= t0)


def _days(a: date, b: date):
    d = a
    while d <= b:
        if wspr.day_path(d).exists():
            yield d
        d += timedelta(days=1)


def _trailing_sum(x: np.ndarray, k: int) -> np.ndarray:
    if k <= 1:
        return x
    out = np.full_like(x, np.nan)
    c = np.convolve(x, np.ones(k), mode="valid")  # a NaN anywhere in the window stays NaN
    out[k - 1 :] = c
    return out


def index_series(s: pl.DataFrame, p: DetectorParams, smooth: int, mode: str) -> np.ndarray:
    cols = [_trailing_sum(s[c].to_numpy().astype(float), smooth) for c in ("n_lit", "exp_lit", "n_dark", "exp_dark")]
    idx = suppression_index(*cols, min_expected=p.min_expected)
    if mode == "sudden":
        idx = relative_to_recent(idx, ref_bins=30, gap=2)
    return idx


def run_detector(s: pl.DataFrame, p: DetectorParams, smooth: int, mode: str = "level",
                 idx: np.ndarray | None = None) -> tuple[list[datetime], np.ndarray]:
    if idx is None:
        idx = index_series(s, p, smooth, mode)
    onsets = detect(idx, p)
    t = s["t"].to_numpy()
    alarms = []
    for i in onsets:
        j = min(i + p.min_run - 1, len(t) - 1)
        alarms.append(datetime.fromtimestamp(int(t[j]) + 120, tz=timezone.utc).replace(tzinfo=None))
    return alarms, idx


def truth(flares: pl.DataFrame, d0: date, d1: date, lo: float = 1e-5, hi: float = 1.0) -> list[Event]:
    """NOAA flares with lo <= peak class flux < hi and peak inside [d0, d1]. Default: R1+ (M1 and above)."""
    a = datetime(d0.year, d0.month, d0.day, tzinfo=timezone.utc)
    b = datetime(d1.year, d1.month, d1.day, tzinfo=timezone.utc) + timedelta(days=1)
    f = flares.filter((pl.col("class_flux") >= lo) & (pl.col("class_flux") < hi) & (pl.col("peak") >= a) & (pl.col("peak") < b))
    return [
        Event(
            id=str(r["flare_id"]),
            start=r["start"].replace(tzinfo=None),
            peak=r["peak"].replace(tzinfo=None),
            end=r["end"].replace(tzinfo=None),
            cls=r["cls"],
        )
        for r in f.iter_rows(named=True)
    ]


EARLY = timedelta(minutes=4)  # flare start minute vs 2-minute WSPR bin quantization
LATE = timedelta(minutes=10)


def observable(ev: Event, s: pl.DataFrame, p: DetectorParams, smooth: int) -> bool:
    """True if the sunlit and dark expectations at the flare peak meet min_expected."""
    t = s["t"].to_numpy()
    tp = int(ev.peak.replace(tzinfo=timezone.utc).timestamp()) // 120 * 120
    j = int(np.searchsorted(t, tp))
    if j >= len(t) or t[j] != tp:
        return False
    lo = max(0, j - smooth + 1)
    el = np.nansum(s["exp_lit"].to_numpy()[lo : j + 1])
    ed = np.nansum(s["exp_dark"].to_numpy()[lo : j + 1])
    return bool(el >= p.min_expected and ed >= p.min_expected)


def _windows(evs: list[Event]) -> tuple[np.ndarray, np.ndarray]:
    lo = np.array([(e.start - EARLY).timestamp() for e in evs])
    hi = np.array([(e.end + LATE).timestamp() for e in evs])
    return lo, hi


def in_any_window(t: datetime, evs: list[Event] | tuple[np.ndarray, np.ndarray]) -> bool:
    lo, hi = evs if isinstance(evs, tuple) else _windows(evs)
    x = t.timestamp()
    return bool(np.any((lo <= x) & (x <= hi)))


def evaluate(s: pl.DataFrame, events: list[Event], p: DetectorParams, smooth: int, mode: str = "level",
             idx: np.ndarray | None = None, neutral: list[Event] | None = None,
             c_flares: list[Event] | None = None) -> dict:
    """Score alarms against events. Alarms inside a `neutral` event window (but not
    inside a target window) are dropped before scoring: neither hit nor false alarm."""
    alarms, _ = run_detector(s, p, smooth, mode, idx)
    n_neutral = 0
    w_ev = _windows(events)
    if neutral:
        w_neu = _windows(neutral)
        kept = []
        for a in alarms:
            if in_any_window(a, w_neu) and not in_any_window(a, w_ev):
                n_neutral += 1
            else:
                kept.append(a)
        alarms = kept
    sc = score(alarms, events, early_tol=EARLY, late_tol=LATE)
    matched = {eid for eid, _ in sc.matches}
    by_r: dict[str, list[int]] = {}
    for ev in events:
        r = r_scale(class_to_flux(ev.cls))
        key = "R3+" if r >= 3 else f"R{r}"
        hit, tot = by_r.get(key, [0, 0])
        by_r[key] = [hit + (ev.id in matched), tot + 1]
    obs = [ev for ev in events if observable(ev, s, p, smooth)]
    obs_hit = sum(ev.id in matched for ev in obs)
    return {
        "params": {**asdict(p), "smooth": smooth, "mode": mode},
        "tp": sc.tp,
        "fp": sc.fp,
        "fn": sc.fn,
        "precision": sc.precision,
        "recall": sc.recall,
        "f1": (2 * sc.tp / (2 * sc.tp + sc.fp + sc.fn)) if sc.tp else 0.0,
        "median_delay_min": sc.median_delay_min,
        "delay_p25_p75": [float(np.percentile(sc.delays_min, 25)), float(np.percentile(sc.delays_min, 75))]
        if sc.delays_min
        else None,
        "recall_by_r": {k: {"hit": v[0], "n": v[1]} for k, v in sorted(by_r.items())},
        "observable_n": len(obs),
        "observable_recall": obs_hit / len(obs) if obs else None,
        "n_alarms": len(alarms),
        "n_neutral_alarms": n_neutral,
        "fp_on_c_flares": None if c_flares is None else sum(
            in_any_window(a, _windows(c_flares)) for a in alarms if not in_any_window(a, w_ev)),
        "alarms": [a.isoformat() for a in alarms],
        "matches": [[eid, d.isoformat()] for eid, d in sc.matches],
    }
