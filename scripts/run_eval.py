"""Reproduce every headline number: event study, placebo, dose-response, detector.

Reads only cached data (data/flares, data/wspr/days). Writes
web/public/data/results.json, which the site reads, and
data/derived/events.parquet for inspection.
Usage: make eval   (or .venv/bin/python scripts/run_eval.py)
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import polars as pl

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sunburn import events, wspr  # noqa: E402
from sunburn.detector import DetectorParams  # noqa: E402
from sunburn.evaluate import evaluate, index_series, series, truth  # noqa: E402
from sunburn.flares import load_flares  # noqa: E402

OUT = ROOT / "web" / "public" / "data" / "results.json"
DERIVED = ROOT / "data" / "derived"
TUNE = (date(2024, 1, 1), date(2024, 12, 31))
HOLDOUT = (date(2025, 1, 1), date(2026, 11, 12))
N_PLACEBO = 400
SEED = 25


def r(x, nd=4):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), nd)


def pre_contaminated(mx: pl.DataFrame) -> set[int]:
    """Flares whose pre-flare hour overlaps another M1+ flare (its start to end + 30 min).

    The difference in differences assumes the pre window is undisturbed; after
    an earlier flare the sunlit side is already suppressed, so the drop would
    be measured from a depressed level.
    """
    st = np.array([x.timestamp() for x in mx["start"]])
    en = np.array([x.timestamp() for x in mx["end"]]) + 1800
    ids = mx["flare_id"].to_list()
    bad = set()
    for i in range(len(ids)):
        a, b = st[i] - 3600, st[i]
        hit = (st < b) & (en > a)
        hit[i] = False
        if hit.any():
            bad.add(ids[i])
    return bad


def event_rows(fl: pl.DataFrame, mx_peaks: list[datetime]) -> list[dict]:
    rows = []
    mx = fl.filter(pl.col("class_flux") >= 1e-5)
    dirty = pre_contaminated(mx)
    for i, f in enumerate(mx.iter_rows(named=True)):
        res = events.analyse(f["peak"], f["start"], mx_peaks)
        row = {
            "id": str(f["flare_id"]),
            "cls": f["cls"],
            "start": f["start"].strftime("%Y-%m-%dT%H:%M"),
            "peak": f["peak"].strftime("%Y-%m-%dT%H:%M"),
            "end": f["end"].strftime("%Y-%m-%dT%H:%M"),
            "flux": f["class_flux"],
            "r": f["r"],
            "status": "no_data" if res is None else "ok",
        }
        if res is not None:
            lo = res["low_hf"]
            row.update(
                drop=r(lo["drop"]),
                S_lit=r(lo["S_lit"]),
                S_dark=r(lo["S_dark"]),
                lit_base=r(lo["lit_base_resp"], 1),
                dark_base=r(lo["dark_base_resp"], 1),
                bands={str(b): r(v["drop"]) for b, v in res["bands"].items()},
            )
            if lo["drop"] is None:
                row["status"] = "thin_coverage"
            elif f["flare_id"] in dirty:
                row["status"] = "pre_overlap"
        rows.append(row)
        if (i + 1) % 200 == 0:
            print(f"  events {i + 1}/{mx.height}", flush=True)
    return rows


def placebo_rows(fl: pl.DataFrame, mx_peaks: list[datetime]) -> list[dict]:
    """Random times with no M1+ flare within 3 h, analysed exactly like flares.

    The pseudo flare starts at the random time and peaks 10 minutes later
    (about the median rise time of the M and X flares in the list).
    """
    rng = np.random.default_rng(SEED)
    mx = fl.filter(pl.col("class_flux") >= 1e-5)
    starts = np.array([s.timestamp() for s in mx["start"]])
    ends = np.array([e.timestamp() for e in mx["end"]])
    lo = datetime(2020, 1, 1, tzinfo=timezone.utc).timestamp()
    hi = datetime(2026, 11, 12, tzinfo=timezone.utc).timestamp()
    rows: list[dict] = []
    tries = 0
    while len(rows) < N_PLACEBO and tries < N_PLACEBO * 20:
        tries += 1
        t = float(rng.uniform(lo, hi))
        t = t - t % 120
        if np.any((starts - 3 * 3600 <= t + 3600) & (ends + 3 * 3600 >= t)):
            continue
        st = datetime.fromtimestamp(t, tz=timezone.utc)
        pk = st + timedelta(minutes=10)
        res = events.analyse(pk, st, mx_peaks)
        if res is None or res["low_hf"]["drop"] is None:
            continue
        rows.append({"start": st.strftime("%Y-%m-%dT%H:%M"), "drop": r(res["low_hf"]["drop"]),
                     "bands": {str(b): r(v["drop"]) for b, v in res["bands"].items()}})
    return rows


CLASS_BINS = [("M1 to M2", 1e-5, 2e-5), ("M2 to M5", 2e-5, 5e-5), ("M5 to X1", 5e-5, 1e-4),
              ("X1 to X2", 1e-4, 2e-4), ("X2 and above", 2e-4, 1.0)]


def summarize(vals: list[float]) -> dict:
    a = np.array(vals, dtype=float)
    if len(a) == 0:
        return {"n": 0}
    q = np.percentile(a, [25, 50, 75])
    return {"n": int(len(a)), "p25": r(q[0]), "median": r(q[1]), "p75": r(q[2]), "mean": r(a.mean())}


def coverage() -> dict:
    """Facts about the downloaded WSPR aggregates, shown in the methodology."""
    days = sorted((wspr.CACHE / "days").glob("*.parquet"))
    spots, gap_days, short_days = [], 0, 0
    for f in days:
        df = pl.read_parquet(f)
        spots.append(int(df["n"].sum()))
        mm = (df["t"] % 3600) // 60
        head = df.filter(mm < 6)["n"].sum() / 3
        rest = df.filter(mm >= 6)["n"].sum() / 27
        gap_days += bool(rest > 0 and head / rest < 0.3)
        short_days += df["t"].n_unique() < 700
    return {"n_days": len(days), "first_day": days[0].stem, "last_day": days[-1].stem,
            "total_spots": int(sum(spots)), "mean_spots_per_day": int(np.mean(spots)),
            "top_of_hour_gap_days": gap_days, "outage_days": short_days}


def main() -> None:
    fl = load_flares()
    mx_peaks = fl.filter(pl.col("class_flux") >= 1e-5)["peak"].to_list()
    print("event study", flush=True)
    ev = event_rows(fl, mx_peaks)
    ok = [e for e in ev if e["status"] == "ok"]
    print(f"  {len(ok)} analysed of {len(ev)} M/X flares", flush=True)
    print("placebo", flush=True)
    pl_rows = placebo_rows(fl, mx_peaks)

    x = np.log10([e["flux"] for e in ok])
    y = np.array([e["drop"] for e in ok])
    slope, s_lo, s_hi = events.bootstrap_slope(x, y) if len(ok) > 5 else (None, None, None)
    bins = []
    for name, a, b in CLASS_BINS:
        vals = [e["drop"] for e in ok if a <= e["flux"] < b]
        bins.append({"label": name, "lo": a, "hi": b, **summarize(vals)})
    placebo_drops = [p["drop"] for p in pl_rows]
    # share of placebo windows with a drop at least as large as the median X-class drop
    x_med = summarize([e["drop"] for e in ok if e["flux"] >= 1e-4]).get("median")
    p_exceed = (float(np.mean(np.array(placebo_drops) >= x_med)) if (x_med is not None and placebo_drops) else None)

    freq = {}
    for b in wspr.HF_BANDS:
        freq[str(b)] = {
            "band_m": wspr.BAND_M[b],
            "x": summarize([e["bands"][str(b)] for e in ok if e["flux"] >= 1e-4 and e["bands"].get(str(b)) is not None]),
            "m5x1": summarize([e["bands"][str(b)] for e in ok if 5e-5 <= e["flux"] < 1e-4 and e["bands"].get(str(b)) is not None]),
            "placebo": summarize([p["bands"][str(b)] for p in pl_rows if p["bands"].get(str(b)) is not None]),
        }

    print("detector", flush=True)
    grid = []
    s_tune = series(*TUNE)
    ev_tune = truth(fl, *TUNE)
    for mode in ("level", "sudden"):
        for smooth in (1, 3):
            for min_exp in (20.0, 60.0):
                base = DetectorParams(min_expected=min_exp)
                idx = index_series(s_tune, base, smooth, mode)
                for thr in (0.4, 0.5, 0.6, 0.7):
                    for run in (1, 2, 3):
                        p = DetectorParams(threshold=thr, min_run=run, refractory=30, min_expected=min_exp)
                        grid.append(evaluate(s_tune, ev_tune, p, smooth, mode, idx))
    best = max(grid, key=lambda m: (m["f1"], m["precision"] or 0))
    bp = best["params"]
    p_best = DetectorParams(threshold=bp["threshold"], min_run=bp["min_run"], refractory=bp["refractory"],
                            min_expected=bp["min_expected"])
    s_hold = series(*HOLDOUT)
    ev_hold = truth(fl, *HOLDOUT)
    # the best configuration of the other variant, for an honest comparison in the README
    other = max((g for g in grid if g["params"]["mode"] != bp["mode"]), key=lambda m: (m["f1"], m["precision"] or 0))
    op = other["params"]
    hold_other = evaluate(s_hold, ev_hold, DetectorParams(threshold=op["threshold"], min_run=op["min_run"],
                          refractory=op["refractory"], min_expected=op["min_expected"]), op["smooth"], op["mode"])
    c_hold = truth(fl, *HOLDOUT, lo=1e-6, hi=1e-5)
    hold = evaluate(s_hold, ev_hold, p_best, bp["smooth"], bp["mode"], c_flares=c_hold)

    # Second target: R2 and stronger (M5+). Alarms on R1 flares are neutral.
    ev_tune2, neu_tune = truth(fl, *TUNE, lo=5e-5), truth(fl, *TUNE, lo=1e-5, hi=5e-5)
    grid2 = []
    for mode in ("level", "sudden"):
        for smooth in (1, 3):
            for min_exp in (20.0, 60.0):
                base = DetectorParams(min_expected=min_exp)
                idx = index_series(s_tune, base, smooth, mode)
                for thr in (0.3, 0.4, 0.5, 0.6, 0.7):
                    for run in (1, 2, 3):
                        p = DetectorParams(threshold=thr, min_run=run, refractory=30, min_expected=min_exp)
                        grid2.append(evaluate(s_tune, ev_tune2, p, smooth, mode, idx, neutral=neu_tune))
    best2 = max(grid2, key=lambda m: (m["f1"], m["precision"] or 0))
    b2 = best2["params"]
    hold2 = evaluate(s_hold, truth(fl, *HOLDOUT, lo=5e-5), DetectorParams(threshold=b2["threshold"], min_run=b2["min_run"],
                     refractory=b2["refractory"], min_expected=b2["min_expected"]), b2["smooth"], b2["mode"],
                     neutral=truth(fl, *HOLDOUT, lo=1e-5, hi=5e-5), c_flares=c_hold)
    missing_hold = sum(1 for _ in range((HOLDOUT[1] - HOLDOUT[0]).days + 1)) - sum(
        wspr.day_path(HOLDOUT[0] + timedelta(days=i)).exists() for i in range((HOLDOUT[1] - HOLDOUT[0]).days + 1))

    out = {
        "generated_from": "scripts/run_eval.py",
        "coverage": coverage(),
        "flare_list": {
            "source": "NOAA NCEI GOES-R XRS L2 flare summary (xrsf-l2-flsum v2-2-2), GOES-16 to 2025-04-07, GOES-19 after",
            "first_peak": fl["peak"].min().strftime("%Y-%m-%d"),
            "last_peak": fl["peak"].max().strftime("%Y-%m-%d"),
            "n_m": int(fl.filter((pl.col("class_flux") >= 1e-5) & (pl.col("class_flux") < 1e-4)).height),
            "n_x": int(fl.filter(pl.col("class_flux") >= 1e-4).height),
        },
        "event_study": {
            "windows": {"pre_min_rel_start": list(events.PRE), "response_min_rel_peak": list(events.RESP)},
            "n_flares": len(ev),
            "n_analysed": len(ok),
            "n_no_data": sum(e["status"] == "no_data" for e in ev),
            "n_thin": sum(e["status"] == "thin_coverage" for e in ev),
            "n_pre_overlap": sum(e["status"] == "pre_overlap" for e in ev),
            "flares": ev,
            "dose": {"slope_per_decade": r(slope), "ci95": [r(s_lo), r(s_hi)], "bins": bins},
            "placebo": {"n": len(pl_rows), **summarize(placebo_drops), "drops": placebo_drops,
                        "share_ge_x_median": r(p_exceed)},
            "frequency": freq,
        },
        "detector": {
            "tune_period": [str(TUNE[0]), str(TUNE[1])],
            "holdout_period": [str(HOLDOUT[0]), str(HOLDOUT[1])],
            "holdout_missing_days": missing_hold,
            "selection": "max F1 on the tuning period (ties: higher precision)",
            "grid": [{k: v for k, v in g.items() if k not in ("alarms", "matches")} for g in grid],
            "tune_best": {k: v for k, v in best.items() if k not in ("alarms", "matches")},
            "holdout": {k: v for k, v in hold.items() if k != "matches"},
            "r2_tune_best": {k: v for k, v in best2.items() if k not in ("alarms", "matches")},
            "r2_holdout": {k: v for k, v in hold2.items() if k != "matches"},
            "holdout_other_variant": {k: v for k, v in hold_other.items() if k not in ("alarms", "matches")},
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    DERIVED.mkdir(parents=True, exist_ok=True)
    pl.DataFrame([{k: v for k, v in e.items() if k != "bands"} for e in ev]).write_parquet(DERIVED / "events.parquet")
    print(json.dumps({"analysed": len(ok), "dose": out["event_study"]["dose"], "placebo_median": out["event_study"]["placebo"].get("median"),
                      "holdout": {k: hold[k] for k in ("precision", "recall", "median_delay_min", "tp", "fp", "fn", "recall_by_r", "observable_recall")},
                      "tune_params": bp,
                      "r2_holdout": {k: hold2[k] for k in ("precision", "recall", "median_delay_min", "tp", "fp", "fn", "n_neutral_alarms", "params")},
                      "fp_on_c": hold["fp_on_c_flares"]}, indent=1))


if __name__ == "__main__":
    main()
