"""NOAA flare list from the NCEI GOES-R XRS L2 flare summary (xrsf-l2-flsum).

Each flare appears as up to four records sharing a flare_id, with status
EVENT_START, EVENT_PEAK, EVENT_END, POST_EVENT. The class is on the peak
record. GOES-16 was the primary satellite until 2025-04-07, GOES-19 after;
I use whichever was primary at the time so no flare is counted twice.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import polars as pl

DATA = Path(__file__).resolve().parent.parent / "data" / "flares"
G16 = "sci_xrsf-l2-flsum_g16_s20170209_e20250407_v2-2-2.nc"
G19 = "sci_xrsf-l2-flsum_g19_s20240920_e20261113_v2-2-2.nc"
HANDOVER = datetime(2025, 4, 7, tzinfo=timezone.utc)
EPOCH = datetime(2000, 1, 1, 12, tzinfo=timezone.utc)
CYCLE25_START = datetime(2019, 12, 1, tzinfo=timezone.utc)


def class_to_flux(cls: str) -> float:
    """'X8.7' -> 8.7e-4 W/m^2 (GOES XRS-B 1 to 8 Angstrom peak flux)."""
    scale = {"A": 1e-8, "B": 1e-7, "C": 1e-6, "M": 1e-5, "X": 1e-4}[cls[0].upper()]
    return float(cls[1:]) * scale


def r_scale(peak_flux: float) -> int:
    """NOAA radio blackout scale from peak XRS-B flux: R1 = M1 ... R5 = X20, 0 below M1."""
    for level, thr in ((5, 2e-3), (4, 1e-3), (3, 1e-4), (2, 5e-5), (1, 1e-5)):
        if peak_flux >= thr:
            return level
    return 0


def _read(path: Path, sat: int) -> pl.DataFrame:
    import netCDF4

    d = netCDF4.Dataset(path)
    t = np.asarray(d["time"][:], dtype=float)
    df = pl.DataFrame(
        {
            "time": [EPOCH + timedelta(seconds=float(x)) for x in t],
            "status": [str(s) for s in d["status"][:]],
            "flare_class": [str(s) for s in d["flare_class"][:]],
            "flux": np.ma.filled(d["xrsb_flux"][:].astype(float), np.nan),
            "flare_id": np.asarray(d["flare_id"][:], dtype=np.int64),
        }
    )
    d.close()
    piv = df.group_by("flare_id").agg(
        pl.col("time").filter(pl.col("status") == "EVENT_START").first().alias("start"),
        pl.col("time").filter(pl.col("status") == "EVENT_PEAK").first().alias("peak"),
        pl.col("time").filter(pl.col("status") == "EVENT_END").first().alias("end"),
        pl.col("flare_class").filter(pl.col("status") == "EVENT_PEAK").first().alias("cls"),
        pl.col("flux").filter(pl.col("status") == "EVENT_PEAK").first().alias("peak_flux"),
    )
    return piv.with_columns(pl.lit(sat).alias("sat"))


def load_flares() -> pl.DataFrame:
    """All cycle 25 flares with start, peak, end, class, flux, R level."""
    a = _read(DATA / G16, 16).filter(pl.col("peak") < HANDOVER)
    b = _read(DATA / G19, 19).filter(pl.col("peak") >= HANDOVER)
    df = pl.concat([a, b]).filter(pl.col("peak").is_not_null() & (pl.col("cls").str.len_chars() > 1))
    df = df.filter(pl.col("peak") >= CYCLE25_START)
    df = df.with_columns(
        pl.col("cls").map_elements(class_to_flux, return_dtype=pl.Float64).alias("class_flux"),
    ).with_columns(
        pl.col("class_flux").map_elements(r_scale, return_dtype=pl.Int64).alias("r"),
        # A missing start or end falls back to the peak time.
        pl.col("start").fill_null(pl.col("peak")),
        pl.col("end").fill_null(pl.col("peak")),
    )
    return df.sort("peak")
