"""Quiet-day baseline for spot counts.

For an event at time t, the baseline for each (band, illumination class,
time bin) is the median count at the same UTC time of day on the K nearest
quiet days on either side. A day is quiet if no M or X flare peaks inside
the analysis window on that day. Same UTC time of day controls for the
diurnal cycle and the daily operator rhythm; nearest days control for season
and slow trends in WSPR participation.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import polars as pl


def quiet_days(
    event_peak: datetime,
    flare_peaks: list[datetime],
    k: int = 5,
    max_search: int = 20,
    window: timedelta = timedelta(hours=3),
) -> list[int]:
    """Day offsets (nonzero ints) of the k nearest quiet days on each side.

    A candidate day d is rejected if any flare in flare_peaks lies within
    +/- window of (event_peak + d days).
    """
    out: list[int] = []
    for sign in (-1, 1):
        found = 0
        for n in range(1, max_search + 1):
            d = sign * n
            centre = event_peak + timedelta(days=d)
            if any(abs(fp - centre) <= window for fp in flare_peaks):
                continue
            out.append(d)
            found += 1
            if found == k:
                break
    return sorted(out)


def baseline_counts(counts: pl.DataFrame, offsets: list[int]) -> pl.DataFrame:
    """Median baseline per (band, lit, rel_min) across the given day offsets.

    counts must have columns: day_offset (int, 0 = event day), band, lit
    (bool), rel_min (minutes relative to flare peak), n (spot count).
    Missing (offset, band, lit, rel_min) cells are treated as zero spots,
    because an absent row from a GROUP BY means nothing was heard.
    """
    base = counts.filter(pl.col("day_offset").is_in(offsets))
    keys = base.select("band", "lit", "rel_min").unique()
    grid = keys.join(pl.DataFrame({"day_offset": offsets}), how="cross")
    full = grid.join(base, on=["day_offset", "band", "lit", "rel_min"], how="left").with_columns(
        pl.col("n").fill_null(0)
    )
    return full.group_by("band", "lit", "rel_min").agg(
        pl.col("n").median().alias("base"),
        pl.col("n").std().alias("base_sd"),
        pl.len().alias("n_days"),
    )


def event_ratio(counts: pl.DataFrame, offsets: list[int]) -> pl.DataFrame:
    """Join event-day counts to the baseline and compute ratio = n / base."""
    ev = counts.filter(pl.col("day_offset") == 0).select("band", "lit", "rel_min", "n")
    base = baseline_counts(counts, offsets)
    return (
        base.join(ev, on=["band", "lit", "rel_min"], how="left")
        .with_columns(pl.col("n").fill_null(0))
        .with_columns(
            pl.when(pl.col("base") > 0).then(pl.col("n") / pl.col("base")).otherwise(None).alias("ratio")
        )
        .sort("band", "lit", "rel_min")
    )
