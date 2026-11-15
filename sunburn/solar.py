"""Solar geometry: subsolar point, solar zenith angle, great-circle midpoint.

Uses the NOAA Solar Calculator formulation (Meeus). I first used the
shorter Spencer (1971) Fourier series, but it is off by 0.3 deg in
declination at the March equinox, which the unit tests caught.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

import numpy as np


def _julian_century(dt: datetime) -> float:
    dt = dt.astimezone(timezone.utc)
    jd = dt.timestamp() / 86400.0 + 2440587.5
    return (jd - 2451545.0) / 36525.0


def declination_and_eot(dt: datetime) -> tuple[float, float]:
    """Return (apparent solar declination in degrees, equation of time in minutes).

    Formulas from the NOAA Solar Calculator spreadsheet (after Meeus,
    Astronomical Algorithms), accurate to about 0.01 deg for 1900 to 2100.
    """
    T = _julian_century(dt)
    L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360.0
    M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
    e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)
    Mr = math.radians(M)
    C = (
        math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T))
        + math.sin(2 * Mr) * (0.019993 - 0.000101 * T)
        + math.sin(3 * Mr) * 0.000289
    )
    true_long = L0 + C
    omega = math.radians(125.04 - 1934.136 * T)
    app_long = true_long - 0.00569 - 0.00478 * math.sin(omega)
    eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60
    eps = eps0 + 0.00256 * math.cos(omega)
    er = math.radians(eps)
    decl = math.degrees(math.asin(math.sin(er) * math.sin(math.radians(app_long))))
    y = math.tan(er / 2) ** 2
    L0r = math.radians(L0)
    eot = 4 * math.degrees(
        y * math.sin(2 * L0r)
        - 2 * e * math.sin(Mr)
        + 4 * e * y * math.sin(Mr) * math.cos(2 * L0r)
        - 0.5 * y * y * math.sin(4 * L0r)
        - 1.25 * e * e * math.sin(2 * Mr)
    )
    return decl, eot


def subsolar_point(dt: datetime) -> tuple[float, float]:
    """Latitude and longitude (degrees, lon in [-180, 180)) where the Sun is overhead."""
    dt = dt.astimezone(timezone.utc)
    decl, eot = declination_and_eot(dt)
    minutes = dt.hour * 60 + dt.minute + dt.second / 60
    lon = -15.0 * (minutes + eot - 720) / 60.0
    lon = (lon + 180.0) % 360.0 - 180.0
    return decl, lon


def solar_zenith(lat, lon, dt: datetime):
    """Solar zenith angle in degrees for scalar or array lat/lon at one instant.

    Computed as the great-circle angle between the point and the subsolar
    point, which is exactly the geometric zenith angle (no refraction).
    """
    slat, slon = subsolar_point(dt)
    lat_r = np.radians(lat)
    slat_r = math.radians(slat)
    dlon = np.radians(np.asarray(lon) - slon)
    cosz = np.sin(lat_r) * math.sin(slat_r) + np.cos(lat_r) * math.cos(slat_r) * np.cos(dlon)
    return np.degrees(np.arccos(np.clip(cosz, -1.0, 1.0)))


def gc_midpoint(lat1, lon1, lat2, lon2):
    """Great-circle midpoint of two points (degrees in, degrees out)."""
    p1, l1, p2, l2 = map(np.radians, (lat1, lon1, lat2, lon2))
    bx = np.cos(p2) * np.cos(l2 - l1)
    by = np.cos(p2) * np.sin(l2 - l1)
    lat = np.arctan2(np.sin(p1) + np.sin(p2), np.sqrt((np.cos(p1) + bx) ** 2 + by**2))
    lon = l1 + np.arctan2(by, np.cos(p1) + bx)
    lon_deg = (np.degrees(lon) + 180.0) % 360.0 - 180.0
    return np.degrees(lat), lon_deg
