PY := .venv/bin/python

.PHONY: setup data featured eval test web build

setup:
	uv venv --python 3.12
	uv pip install -r requirements.txt
	cd web && npm install

# Downloads and caches everything (flare list, ~2,500 daily WSPR aggregates, GOES files, map paths).
data:
	$(PY) scripts/fetch_flares.py
	$(PY) scripts/fetch_days.py

featured:
	$(PY) scripts/build_featured.py --n 20

# Recomputes every number in the UI from cached data -> web/public/data/results.json
eval:
	$(PY) scripts/run_eval.py

test:
	$(PY) -m pytest -q

web:
	cd web && npm run dev

build:
	cd web && npm run build
