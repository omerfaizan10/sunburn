"""wspr.live access: server-side aggregation, local Parquet cache.

wspr.live is a public ClickHouse database (usage notes: filter by time and
band, aggregate with GROUP BY, at most 20 requests per minute). Every query
here computes the path midpoint's solar zenith angle on the server
(sql.ZENITH_ALIASES, unit tested against solar.py) and returns only counts
per (2-minute WSPR cycle, band, 15 deg zenith bucket), so individual spots
never leave the server. Results are cached as Parquet under data/wspr/ and
never requested twice.
"""

from __future__ import annotations

import hashlib
import io
import time
from datetime import datetime
from pathlib import Path

import polars as pl
import requests

from .sql import ZENITH_ALIASES

URL = "https://db1.wspr.live/"
UA = "sunburn-research/0.1"
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "wspr"
# wspr.live band codes are the leading digits of the frequency in MHz:
# 3 = 80 m, 5 = 60 m, 7 = 40 m, 10 = 30 m, 14 = 20 m, 18 = 17 m, 21 = 15 m, 24 = 12 m, 28 = 10 m.
HF_BANDS = (3, 5, 7, 10, 14, 18, 21, 24, 28)
BAND_M = {3: 80, 5: 60, 7: 40, 10: 30, 14: 20, 18: 17, 21: 15, 24: 12, 28: 10}
ZB = 15  # zenith bucket width in degrees
MIN_INTERVAL = 3.5  # seconds between uncached requests, stays under 20 per minute

_last_request = 0.0


def _fmt(t: datetime) -> str:
    return t.strftime("%Y-%m-%d %H:%M:%S")


def _time_filter(windows) -> str:
    return " OR ".join(
        f"(time >= toDateTime('{_fmt(a)}') AND time < toDateTime('{_fmt(b)}'))" for a, b in windows
    )


def counts_query(windows, bands=HF_BANDS) -> str:
    b = ",".join(str(x) for x in bands)
    return f"""
SELECT intDiv(ts, 120) * 120 AS t, band, toUInt8(floor(zen / {ZB})) AS zb, count() AS n
FROM (
  SELECT toUnixTimestamp(time) AS ts, band, tx_lat, tx_lon, rx_lat, rx_lon, {ZENITH_ALIASES}
  FROM wspr.rx
  WHERE band IN ({b}) AND ({_time_filter(windows)})
)
GROUP BY t, band, zb
ORDER BY t, band, zb
FORMAT Parquet
"""


def paths_query(t0: datetime, t1: datetime, bands=(7, 10, 14)) -> str:
    """Distinct 4-character grid pairs heard per 2-minute cycle (for the map)."""
    b = ",".join(str(x) for x in bands)
    return f"""
SELECT intDiv(toUnixTimestamp(time), 120) * 120 AS t, band,
  substring(tx_loc, 1, 4) AS tx, substring(rx_loc, 1, 4) AS rx,
  any(tx_lat) AS tx_lat, any(tx_lon) AS tx_lon, any(rx_lat) AS rx_lat, any(rx_lon) AS rx_lon,
  count() AS n
FROM wspr.rx
WHERE band IN ({b}) AND time >= toDateTime('{_fmt(t0)}') AND time < toDateTime('{_fmt(t1)}')
GROUP BY t, band, tx, rx
FORMAT Parquet
"""


def run(query: str, tag: str) -> pl.DataFrame:
    """Execute a query with caching, pacing and retries."""
    global _last_request
    key = hashlib.sha1(query.encode()).hexdigest()[:16]
    path = CACHE / f"{tag}_{key}.parquet"
    if path.exists():
        return pl.read_parquet(path)
    CACHE.mkdir(parents=True, exist_ok=True)
    err = None
    for attempt in range(5):
        wait = MIN_INTERVAL - (time.monotonic() - _last_request)
        if wait > 0:
            time.sleep(wait)
        _last_request = time.monotonic()
        try:
            # wspr.live only accepts GET (POST returns 403 from its nginx front end).
            r = requests.get(URL, params={"query": query}, headers={"User-Agent": UA}, timeout=300)
        except requests.RequestException as e:  # network hiccup: back off and retry
            err = e
            time.sleep(10 * 2**attempt)
            continue
        if r.status_code == 200:
            df = pl.read_parquet(io.BytesIO(r.content)) if r.content else pl.DataFrame()
            df.write_parquet(path)
            return df
        err = RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
        if 400 <= r.status_code < 500 and r.status_code != 429:
            break  # a malformed or refused query will not succeed on retry
        time.sleep(10 * 2**attempt)
    raise err  # type: ignore[misc]


def day_path(day) -> Path:
    return CACHE / "days" / f"{day:%Y%m%d}.parquet"


def fetch_day(day) -> pl.DataFrame:
    """Counts per (2-min bin, band, zenith bucket) for one UTC day, cached by date."""
    from datetime import datetime, timedelta

    path = day_path(day)
    if path.exists():
        return pl.read_parquet(path)
    t0 = datetime(day.year, day.month, day.day)
    df = run(counts_query([(t0, t0 + timedelta(days=1))]), "tmp")
    path.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(path)
    # the hashed copy written by run() is redundant once the dated file exists
    for f in CACHE.glob("tmp_*.parquet"):
        f.unlink()
    return df
