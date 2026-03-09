# Ephemeris Fusion Guide

This project now supports a hybrid ephemeris workflow:

- Internal solver (`OrbitalMechanics`) for fast rendering and medium-range forecasts.
- JPL Horizons proxy for high-precision baseline vectors.
- JSONL archive output for ML and Python tools.

## What Is Implemented

- `GET /api/ephemeris/horizons?body=<name>&date=<iso>`
  - Proxies JPL Horizons vectors and returns parsed heliocentric AU coordinates.
- `POST /api/ephemeris/archive`
  - Appends one JSON object per line to `data/ephemeris/archive.jsonl`.
- `GET /api/ephemeris/archive?limit=50`
  - Reads recent archived rows.
- `Trajectory Forecast` panel
  - Exports CSV and NDJSON, includes planets + moons.
  - High-Precision mode fetches Horizons vectors and computes residuals.

## Archive Schema (JSONL)

Each line in `data/ephemeris/archive.jsonl` contains:

- `ts`: archive timestamp
- `schemaVersion`: version integer
- `modelDate`: reference timestamp used by model
- `daysAhead`, `stepDays`, `includeMoons`
- `selectedBodies`: body list
- `confidence`: model confidence payload
- `sunEstimate`: stellar-stage estimate payload
- `horizonsVectors`: optional JPL baseline vectors
- `residualRows`: optional residuals vs internal solver
- `horizonSnapshot`: endpoint snapshot vectors

This format is suitable for:

- Python/pandas (`read_json(..., lines=True)`)
- scikit-learn feature extraction
- TensorFlow/PyTorch trajectory modeling
- residual calibration models

## Python Quick Start

```python
import pandas as pd

rows = pd.read_json('data/ephemeris/archive.jsonl', lines=True)
print(rows[['ts', 'modelDate', 'daysAhead', 'stepDays']].tail())
```

## Source Fusion Strategy

Use each free source for what it does best:

1. JPL Horizons API: baseline vectors for planets/moons, online validation.
2. JPL DE/SPK + NAIF SPICE: offline, highest precision replay pipelines.
3. IMCCE INPOP: independent cross-check against JPL products.
4. MPC: small-body orbit updates and uncertainty-aware catalogs.

Recommended weighting for production inference:

- Horizons/SPICE: primary truth source for training labels.
- Internal solver: real-time interpolation and rendering.
- INPOP: validation and drift detection.
- MPC: augment asteroid/comet forecasting.

## Known Limits

- Internal orbital model remains approximate vs full N-body/SPICE.
- Sun evolution output is stage-level model guidance, not full stellar simulation.
- Horizons integration currently targets vector snapshots; extended batch pulls can be added.

## Next Upgrade Ideas

- Add a nightly batch job to harvest Horizons for all bodies and append JSONL automatically.
- Add SPICE kernel ingestion pipeline for offline high-fidelity datasets.
- Add uncertainty columns (covariance/proxy confidence) per body and timestamp.
- Add moon rotation/physical ephemeris (pole orientation, spin phase) feed for rendering.
