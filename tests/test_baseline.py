from datetime import datetime, timedelta

import polars as pl
import pytest

from sunburn.baseline import baseline_counts, event_ratio, quiet_days

T = datetime(2024, 5, 14, 16, 51)


def test_quiet_days_symmetric_when_no_other_flares():
    assert quiet_days(T, [T], k=3) == [-3, -2, -1, 1, 2, 3]


def test_quiet_days_skips_flare_days():
    others = [T, T + timedelta(days=1, hours=1), T - timedelta(days=2, minutes=-30)]
    assert quiet_days(T, others, k=2) == [-3, -1, 2, 3]


def test_quiet_days_window_edge():
    # A flare 4 h off the same clock time on day +1 is outside a 3 h window.
    assert 1 in quiet_days(T, [T + timedelta(days=1, hours=4)], k=1)


# Labeled fixture (not real data): one band, sunlit, two time bins.
FIXTURE = pl.DataFrame(
    {
        "day_offset": [-2, -1, 1, 2, 0, -2, -1, 1, 0],
        "band": [7] * 9,
        "lit": [True] * 9,
        "rel_min": [0, 0, 0, 0, 0, 2, 2, 2, 2],
        "n": [100, 110, 90, 1000, 30, 40, 60, 50, 50],
    }
)


def test_baseline_median_resists_outlier_and_fills_missing_as_zero():
    b = baseline_counts(FIXTURE, [-2, -1, 1, 2]).sort("rel_min")
    # rel 0: median(100, 110, 90, 1000) = 105
    assert b["base"][0] == pytest.approx(105)
    # rel 2: day +2 missing -> 0, median(40, 60, 50, 0) = 45
    assert b["base"][1] == pytest.approx(45)
    assert b["n_days"].to_list() == [4, 4]


def test_event_ratio():
    r = event_ratio(FIXTURE, [-2, -1, 1, 2]).sort("rel_min")
    assert r["ratio"][0] == pytest.approx(30 / 105)
    assert r["ratio"][1] == pytest.approx(50 / 45)


def test_baseline_excludes_event_day():
    b = baseline_counts(FIXTURE, [-2, -1]).sort("rel_min")
    assert b["base"][0] == pytest.approx(105)
