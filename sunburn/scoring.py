"""Score blind blackout detections against NOAA flare events.

A detection matches an event if it falls in [start - early_tol, end + late_tol].
Each event can be matched by at most one detection (the earliest), and each
detection by at most one event. Unmatched detections are false positives,
unmatched events are misses. Detection delay is measured from the event's
start time (the GOES XRS start, i.e. when NOAA says the flare began).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from statistics import median


@dataclass(frozen=True)
class Event:
    id: str
    start: datetime
    peak: datetime
    end: datetime
    cls: str = ""


@dataclass
class Score:
    tp: int
    fp: int
    fn: int
    delays_min: list[float] = field(default_factory=list)
    matches: list[tuple[str, datetime]] = field(default_factory=list)

    @property
    def precision(self) -> float | None:
        return self.tp / (self.tp + self.fp) if (self.tp + self.fp) else None

    @property
    def recall(self) -> float | None:
        return self.tp / (self.tp + self.fn) if (self.tp + self.fn) else None

    @property
    def median_delay_min(self) -> float | None:
        return median(self.delays_min) if self.delays_min else None


def score(
    detections: list[datetime],
    events: list[Event],
    early_tol: timedelta = timedelta(minutes=0),
    late_tol: timedelta = timedelta(minutes=10),
) -> Score:
    dets = sorted(detections)
    used = [False] * len(dets)
    tp = 0
    delays: list[float] = []
    matches: list[tuple[str, datetime]] = []
    for ev in sorted(events, key=lambda e: e.start):
        lo, hi = ev.start - early_tol, ev.end + late_tol
        for i, d in enumerate(dets):
            if used[i] or d < lo:
                continue
            if d > hi:
                break
            used[i] = True
            tp += 1
            delays.append((d - ev.start).total_seconds() / 60)
            matches.append((ev.id, d))
            break
    fp = used.count(False)
    fn = len(events) - tp
    return Score(tp=tp, fp=fp, fn=fn, delays_min=delays, matches=matches)
