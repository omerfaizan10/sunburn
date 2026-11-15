"""Blind shortwave blackout detector using WSPR spot counts only.

No X-ray input. For each time bin the detector compares sunlit-path spots on
the lower HF bands to what the same bin looked like on recent days, and
divides by the same ratio for dark paths. Dividing by the dark-path ratio
cancels network-wide drops (database ingestion gaps, contest weekends,
reporting outages) that hit both halves of the planet equally, which a flare
does not: D-layer absorption only happens where the Sun is up.

    r_lit  = n_lit  / expected_lit
    r_dark = n_dark / expected_dark
    s      = r_lit / r_dark

Variant "sudden": a flare fade-out begins within minutes, while most other
dips (a band closing at dusk, a quiet day) build slowly. So the index can be
divided again by its own median over the preceding hour (skipping the most
recent `gap` bins), which turns it into "how far below its recent level".

An onset is flagged at the first bin of a run of `min_run` consecutive bins
with s < threshold, after which the detector is silent for `refractory` bins.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class DetectorParams:
    threshold: float = 0.6
    min_run: int = 2
    refractory: int = 30
    min_expected: float = 20.0


def suppression_index(n_lit, exp_lit, n_dark, exp_dark, min_expected: float = 20.0) -> np.ndarray:
    """Ratio of sunlit to dark normalized counts; NaN where expectations are too small."""
    n_lit, exp_lit, n_dark, exp_dark = (np.asarray(a, dtype=float) for a in (n_lit, exp_lit, n_dark, exp_dark))
    ok = (exp_lit >= min_expected) & (exp_dark >= min_expected)
    with np.errstate(divide="ignore", invalid="ignore"):
        r_lit = n_lit / exp_lit
        r_dark = n_dark / exp_dark
        s = r_lit / r_dark
    s[~ok | ~np.isfinite(s)] = np.nan
    return s


def relative_to_recent(s: np.ndarray, ref_bins: int = 30, gap: int = 2) -> np.ndarray:
    """s divided by the median of s over bins [i - gap - ref_bins, i - gap). Causal."""
    s = np.asarray(s, dtype=float)
    out = np.full_like(s, np.nan)
    for i in range(gap + ref_bins, len(s)):
        ref = s[i - gap - ref_bins : i - gap]
        ref = ref[np.isfinite(ref)]
        if len(ref) >= ref_bins // 2:
            m = np.median(ref)
            if m > 0:
                out[i] = s[i] / m
    return out


def detect(s: np.ndarray, p: DetectorParams = DetectorParams()) -> list[int]:
    """Indices of onset bins. NaN bins break a run and never trigger."""
    onsets: list[int] = []
    run = 0
    quiet_until = -1
    for i, v in enumerate(np.asarray(s, dtype=float)):
        if i <= quiet_until:
            run = 0
            continue
        if np.isfinite(v) and v < p.threshold:
            run += 1
            if run == p.min_run:
                onset = i - p.min_run + 1
                onsets.append(onset)
                quiet_until = i + p.refractory
                run = 0
        else:
            run = 0
    return onsets
