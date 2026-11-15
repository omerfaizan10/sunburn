"""GOES-R XRS 1-minute averaged flux (NCEI L2 science product xrsf-l2-avg1m)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import requests

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "goes"
BASE = "https://data.ngdc.noaa.gov/platforms/solar-space-observing-satellites/goes/goes{s}/l2/data/xrsf-l2-avg1m_science/{y}/{m:02d}/"
HANDOVER = date(2025, 4, 7)
EPOCH = datetime(2000, 1, 1, 12, tzinfo=timezone.utc)


def _sat(d: date) -> int:
    return 16 if d < HANDOVER else 19


def day_file(d: date) -> Path:
    s = _sat(d)
    name = f"sci_xrsf-l2-avg1m_g{s}_d{d:%Y%m%d}_v2-2-2.nc"
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        r = requests.get(BASE.format(s=s, y=d.year, m=d.month) + name, headers={"User-Agent": "sunburn-research/0.1"}, timeout=120)
        r.raise_for_status()
        path.write_bytes(r.content)
    return path


def flux(t0: datetime, t1: datetime) -> tuple[list[datetime], np.ndarray]:
    """XRS-B (1 to 8 Angstrom) 1-minute flux in W/m^2 for [t0, t1). NaN where flagged or missing."""
    import netCDF4

    times: list[datetime] = []
    vals: list[float] = []
    d = t0.date()
    while d <= t1.date():
        ds = netCDF4.Dataset(day_file(d))
        tt = np.asarray(ds["time"][:], dtype=float)
        fb = np.ma.filled(ds["xrsb_flux"][:].astype(float), np.nan)
        if "xrsb_flag" in ds.variables:
            flag = np.ma.filled(ds["xrsb_flag"][:], 0)
            fb = np.where(flag == 0, fb, np.nan)
        ds.close()
        for x, v in zip(tt, fb):
            t = (EPOCH + timedelta(seconds=float(x))).replace(tzinfo=None)
            if t0 <= t < t1:
                times.append(t)
                vals.append(v)
        d += timedelta(days=1)
    return times, np.array(vals)
