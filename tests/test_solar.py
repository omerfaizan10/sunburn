from datetime import datetime, timezone

import numpy as np
import pytest

from sunburn.solar import gc_midpoint, solar_zenith, subsolar_point

UTC = timezone.utc


def test_subsolar_lat_at_june_solstice():
    # 2024 June solstice: 2024-06-20 20:51 UTC, declination 23.44 deg.
    lat, _ = subsolar_point(datetime(2024, 6, 20, 20, 51, tzinfo=UTC))
    assert lat == pytest.approx(23.44, abs=0.05)


def test_subsolar_lat_at_march_equinox():
    # 2024 March equinox: 2024-03-20 03:06 UTC.
    lat, _ = subsolar_point(datetime(2024, 3, 20, 3, 6, tzinfo=UTC))
    assert lat == pytest.approx(0.0, abs=0.05)


def test_subsolar_lon_follows_equation_of_time():
    # Early November the equation of time is about +16.4 min, so solar noon at
    # Greenwich is 11:43:36 UTC. By 12:00 UTC the subsolar point has moved
    # 16.4 min * 0.25 deg/min = 4.1 deg west.
    _, lon = subsolar_point(datetime(2024, 11, 3, 12, 0, tzinfo=UTC))
    assert lon == pytest.approx(-4.1, abs=0.05)
    # Mid April the equation of time is near zero.
    _, lon = subsolar_point(datetime(2024, 4, 15, 12, 0, tzinfo=UTC))
    assert lon == pytest.approx(0.0, abs=0.2)


def test_subsolar_lon_moves_15_deg_per_hour_westward():
    _, a = subsolar_point(datetime(2024, 4, 15, 12, 0, tzinfo=UTC))
    _, b = subsolar_point(datetime(2024, 4, 15, 13, 0, tzinfo=UTC))
    assert (a - b) == pytest.approx(15.0, abs=0.01)


def test_zenith_geometry():
    t = datetime(2024, 5, 14, 16, 51, tzinfo=UTC)
    slat, slon = subsolar_point(t)
    assert solar_zenith(slat, slon, t) == pytest.approx(0.0, abs=1e-6)
    assert solar_zenith(-slat, slon + 180, t) == pytest.approx(180.0, abs=1e-6)
    # Zenith angle at the north pole equals 90 deg minus the declination.
    assert solar_zenith(90.0, 0.0, t) == pytest.approx(90.0 - slat, abs=1e-6)


def test_zenith_vectorized_and_sign():
    t = datetime(2024, 12, 21, 12, 0, tzinfo=UTC)  # northern winter, Sun over Greenwich
    z = solar_zenith(np.array([0.0, 0.0]), np.array([0.0, 180.0]), t)
    assert z[0] < 90 < z[1]


def test_gc_midpoint():
    lat, lon = gc_midpoint(0.0, 0.0, 0.0, 90.0)
    assert (lat, lon) == pytest.approx((0.0, 45.0), abs=1e-9)
    lat, lon = gc_midpoint(0.0, 170.0, 0.0, -170.0)
    assert lat == pytest.approx(0.0, abs=1e-9)
    assert abs(lon) == pytest.approx(180.0, abs=1e-9)
    # Midpoint of two points on a meridian is the mean latitude.
    lat, lon = gc_midpoint(10.0, 20.0, 50.0, 20.0)
    assert (lat, lon) == pytest.approx((30.0, 20.0), abs=1e-9)
    # High-latitude path bows poleward of the mean latitude.
    lat, _ = gc_midpoint(50.0, -100.0, 50.0, 0.0)
    assert lat > 55
