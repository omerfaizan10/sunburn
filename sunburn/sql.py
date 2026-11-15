"""Server-side solar zenith angle of a WSPR path midpoint, as SQL.

The same arithmetic as solar.py (NOAA Solar Calculator formulas plus the
great-circle midpoint), written with functions that exist in both ClickHouse
and DuckDB, so the unit tests can run the exact SQL text locally in DuckDB
and compare against the Python reference. No float modulo is needed: the
mean longitude L0 only enters through sin and cos.

Columns expected: ts (unix seconds, integer), tx_lat, tx_lon, rx_lat, rx_lon.
Produces alias `zen` (degrees).
"""

ZENITH_ALIASES = """
  radians(tx_lat) AS _p1, radians(tx_lon) AS _l1, radians(rx_lat) AS _p2, radians(rx_lon) AS _l2,
  cos(_p2) * cos(_l2 - _l1) AS _bx, cos(_p2) * sin(_l2 - _l1) AS _by,
  atan2(sin(_p1) + sin(_p2), sqrt((cos(_p1) + _bx) * (cos(_p1) + _bx) + _by * _by)) AS _mlat,
  _l1 + atan2(_by, cos(_p1) + _bx) AS _mlon,
  (ts / 86400.0 + 2440587.5 - 2451545.0) / 36525.0 AS _T,
  radians(280.46646 + _T * (36000.76983 + _T * 0.0003032)) AS _L0,
  radians(357.52911 + _T * (35999.05029 - 0.0001537 * _T)) AS _M,
  0.016708634 - _T * (0.000042037 + 0.0000001267 * _T) AS _e,
  sin(_M) * (1.914602 - _T * (0.004817 + 0.000014 * _T)) + sin(2 * _M) * (0.019993 - 0.000101 * _T)
    + sin(3 * _M) * 0.000289 AS _C,
  radians(125.04 - 1934.136 * _T) AS _om,
  radians(degrees(_L0) + _C - 0.00569 - 0.00478 * sin(_om)) AS _lam,
  radians(23 + (26 + (21.448 - _T * (46.815 + _T * (0.00059 - _T * 0.001813))) / 60) / 60
    + 0.00256 * cos(_om)) AS _eps,
  asin(sin(_eps) * sin(_lam)) AS _decl,
  tan(_eps / 2) * tan(_eps / 2) AS _y,
  4 * degrees(_y * sin(2 * _L0) - 2 * _e * sin(_M) + 4 * _e * _y * sin(_M) * cos(2 * _L0)
    - 0.5 * _y * _y * sin(4 * _L0) - 1.25 * _e * _e * sin(2 * _M)) AS _eot,
  radians(-15.0 * ((ts % 86400) / 60.0 + _eot - 720) / 60.0) AS _slon,
  degrees(acos(greatest(-1.0, least(1.0,
    sin(_mlat) * sin(_decl) + cos(_mlat) * cos(_decl) * cos(_mlon - _slon))))) AS zen
"""
