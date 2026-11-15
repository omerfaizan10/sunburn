"""Download the NCEI GOES-R XRS flare summary files (GOES-16 and GOES-19)."""

from pathlib import Path

import requests

BASE = "https://data.ngdc.noaa.gov/platforms/solar-space-observing-satellites/goes/goes{n}/l2/data/xrsf-l2-flsum_science/"
FILES = {
    16: "sci_xrsf-l2-flsum_g16_s20170209_e20250407_v2-2-2.nc",
    19: "sci_xrsf-l2-flsum_g19_s20240920_e20261113_v2-2-2.nc",
}
OUT = Path(__file__).resolve().parent.parent / "data" / "flares"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for n, name in FILES.items():
        dest = OUT / name
        if dest.exists():
            print("cached", dest.name)
            continue
        r = requests.get(BASE.format(n=n) + name, headers={"User-Agent": "sunburn-research/0.1"}, timeout=120)
        r.raise_for_status()
        dest.write_bytes(r.content)
        print("saved", dest.name, len(r.content))


if __name__ == "__main__":
    main()
