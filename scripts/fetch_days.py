"""Fetch daily WSPR aggregates for solar cycle 25, most useful days first.

Order: days within 7 days of the 30 largest flares, then the detector
tuning year (2024) and held-out period (2025-01-01 onward), then all
remaining days. Safe to stop and restart: cached days are skipped.
Usage: .venv/bin/python scripts/fetch_days.py [--limit N]
"""

import argparse
import sys
import time
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sunburn import wspr  # noqa: E402
from sunburn.flares import load_flares  # noqa: E402

FIRST, LAST = date(2019, 12, 20), date(2026, 11, 12)


def ordered_days() -> list[date]:
    fl = load_flares().sort("class_flux", descending=True)
    seen: set[date] = set()
    order: list[date] = []

    def add(d: date) -> None:
        if FIRST <= d <= LAST and d not in seen:
            seen.add(d)
            order.append(d)

    for pk in fl.head(30)["peak"]:
        for k in range(-7, 8):
            add(pk.date() + timedelta(days=k))
    d = date(2024, 1, 1)
    while d <= LAST:
        add(d)
        d += timedelta(days=1)
    d = FIRST
    while d <= LAST:
        add(d)
        d += timedelta(days=1)
    return order


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    days = ordered_days()
    todo = [d for d in days if not wspr.day_path(d).exists()]
    if a.limit:
        todo = todo[: a.limit]
    print(f"{len(days)} days total, {len(todo)} to fetch", flush=True)
    t0 = time.time()
    for i, d in enumerate(todo, 1):
        try:
            df = wspr.fetch_day(d)
        except Exception as e:  # report and keep going; rerun picks it up
            print(f"FAIL {d} {e}", flush=True)
            time.sleep(30)
            continue
        if i % 25 == 0 or i == len(todo):
            print(f"{i}/{len(todo)} {d} rows={df.height} elapsed={time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
