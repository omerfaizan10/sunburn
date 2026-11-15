"""The server-side zenith SQL must agree with the Python reference."""

from datetime import datetime, timezone

import duckdb
import numpy as np

from sunburn.solar import gc_midpoint, solar_zenith
from sunburn.sql import ZENITH_ALIASES


def test_sql_zenith_matches_python():
    rng = np.random.default_rng(7)
    n = 300
    tx_lat, rx_lat = rng.uniform(-70, 70, n), rng.uniform(-70, 70, n)
    tx_lon, rx_lon = rng.uniform(-180, 180, n), rng.uniform(-180, 180, n)
    ts = rng.integers(1_577_836_800, 1_790_000_000, n)  # 2020 to 2026
    con = duckdb.connect()
    con.register(
        "spots",
        {"ts": ts, "tx_lat": tx_lat, "tx_lon": tx_lon, "rx_lat": rx_lat, "rx_lon": rx_lon},
    )
    got = con.execute(f"SELECT {ZENITH_ALIASES} FROM spots").df()["zen"].to_numpy()
    exp = np.empty(n)
    for i in range(n):
        mlat, mlon = gc_midpoint(tx_lat[i], tx_lon[i], rx_lat[i], rx_lon[i])
        exp[i] = solar_zenith(mlat, mlon, datetime.fromtimestamp(int(ts[i]), tz=timezone.utc))
    np.testing.assert_allclose(got, exp, atol=1e-6)
