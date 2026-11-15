from datetime import datetime, timedelta

import numpy as np
import pytest

from sunburn.detector import DetectorParams, detect, relative_to_recent, suppression_index
from sunburn.scoring import Event, score

t0 = datetime(2024, 5, 1)


def ev(i, start_min, dur=20):
    s = t0 + timedelta(minutes=start_min)
    return Event(id=f"e{i}", start=s, peak=s + timedelta(minutes=5), end=s + timedelta(minutes=dur))


def m(x):
    return t0 + timedelta(minutes=x)


def test_perfect():
    s = score([m(3), m(103)], [ev(1, 0), ev(2, 100)])
    assert (s.tp, s.fp, s.fn) == (2, 0, 0)
    assert s.precision == 1 and s.recall == 1
    assert s.delays_min == [3, 3]


def test_false_positive_and_miss():
    s = score([m(3), m(500)], [ev(1, 0), ev(2, 100)])
    assert (s.tp, s.fp, s.fn) == (1, 1, 1)
    assert s.precision == 0.5 and s.recall == 0.5


def test_one_detection_cannot_match_two_events():
    # Overlapping events, single detection.
    s = score([m(12)], [ev(1, 0), ev(2, 10)])
    assert (s.tp, s.fp, s.fn) == (1, 0, 1)


def test_duplicate_detections_count_as_fp():
    s = score([m(2), m(4)], [ev(1, 0)])
    assert (s.tp, s.fp, s.fn) == (1, 1, 0)


def test_tolerance_window():
    # end = 20, late_tol 10 -> 30 is in, 31 out. Before start is out with 0 early tol.
    assert score([m(30)], [ev(1, 0)]).tp == 1
    assert score([m(31)], [ev(1, 0)]).tp == 0
    assert score([m(-1)], [ev(1, 0)]).tp == 0
    assert score([m(-1)], [ev(1, 0)], early_tol=timedelta(minutes=2)).delays_min == [-1]


def test_empty_cases():
    s = score([], [])
    assert s.precision is None and s.recall is None and s.median_delay_min is None


def test_suppression_index_cancels_global_drop():
    # Network-wide halving: both halves drop equally -> s = 1.
    s = suppression_index([50], [100], [50], [100])
    assert s[0] == pytest.approx(1.0)
    # Sunlit-only drop -> s = 0.3.
    s = suppression_index([30], [100], [100], [100])
    assert s[0] == pytest.approx(0.3)
    # Too few expected spots -> NaN.
    assert np.isnan(suppression_index([1], [5], [1], [5])[0])


def test_detect_runs_and_refractory():
    p = DetectorParams(threshold=0.6, min_run=2, refractory=3)
    s = np.array([1, 0.5, 1, 0.5, 0.4, 0.3, 0.2, 0.1, 0.1, 1, 0.5, 0.5])
    # Lone dip at 1 ignored; run starts at 3 -> onset 3; quiet until 4+3=7;
    # bins 8.. : 8 low, 9 high, 10-11 low -> onset 10.
    assert detect(s, p) == [3, 10]


def test_detect_nan_breaks_run():
    p = DetectorParams(threshold=0.6, min_run=2, refractory=0)
    assert detect(np.array([0.5, np.nan, 0.5, 1.0]), p) == []


def test_relative_to_recent_is_causal_and_level_free():
    s = np.full(50, 0.5)
    s[40:] = 0.25  # sudden halving from a low but steady level
    r = relative_to_recent(s, ref_bins=10, gap=2)
    assert np.isnan(r[:12]).all()
    assert r[39] == pytest.approx(1.0)
    assert r[40] == pytest.approx(0.5)
    # Changing a future value never changes an earlier output.
    s2 = s.copy()
    s2[45] = 99
    assert np.array_equal(relative_to_recent(s2, 10, 2)[:45], r[:45], equal_nan=True)
