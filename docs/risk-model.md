# RIAUWATCH — Fire-Risk Model Design (Phase 2)

**Date:** 2026-08-24 · **Status:** PROPOSAL — rule-based baseline v0.1, calibration-ready
**Integrity framing (CORE RULES):** this is a **transparent heuristic**, NOT a scientifically validated model and NOT a prediction. Outputs are labeled *Derived risk assessment*; inputs are labeled *Observed data*. The UI must never state that fire occurrence is predicted or certain.

## 1. Purpose

Translate observed conditions into an understandable per-kabupaten/kota risk level with explainable contributing factors. Answer: *"Mengapa risikonya HIGH?"* — with every factor shown, including unavailable ones.

## 2. Factors (v0.1)

All inputs come from adopted sources (see `docs/data-sources.md`). Weights live in a single config file (`risk_config.yaml`-style) — recalibration requires no code change.

| Factor | Input (observed) | Direction | Weight v0.1 | Source |
|---|---|---|---|---|
| Hotspot density | count of hotspots in area, last 48 h, confidence ≥ normal | more → riskier | 0.35 | FIRMS |
| Recent rainfall | accumulated precipitation, last 7 d | less → riskier | 0.20 | Open-Meteo past days |
| Humidity | mean RH, last 24 h | lower → riskier | 0.15 | Open-Meteo |
| Temperature | max temp, last 24 h | higher → riskier | 0.10 | Open-Meteo |
| Wind speed | mean wind, last 24 h | stronger → spread riskier | 0.10 | Open-Meteo |
| Fuel/dryness indicator | — | — | reserved 0.10 | **DEFERRED** until a valid dataset (e.g., peatland map, rainfall climatology) is adopted. Never proxied by invented values. |

> These weights are engineering defaults chosen for explainability, **not** scientific constants. Stated verbatim on the risk UI: "Bobot faktor bersifat konfigurasi awal dan belum tervalidasi secara ilmiah."

Factor normalization: each factor maps its observed value to 0–100 sub-score via piecewise-linear breakpoints defined in config (e.g., rainfall 7 d: ≥50 mm → 0; ≤5 mm → 100; linear between). Breakpoints are calibration targets, documented with initial meteorological reasoning, adjustable without redeploy.

## 3. Scoring & Levels

```
score = Σ (available_factor_subscore × weight) / Σ (available_factor_weights) × 100
```

Missing factors are **excluded and weights renormalized** — never zero-filled, never interpolated. If fewer than 3 of 5 active factors are available, output `INSUFFICIENT_DATA` instead of a level (honest unavailability beats a misleading number).

| Level | Score band |
|---|---|
| LOW | 0–24 |
| MODERATE | 25–49 |
| HIGH | 50–69 |
| VERY HIGH | 70–84 |
| EXTREME | 85–100 |

Bands are config too. Level display always pairs color + text label + icon (never color alone).

## 4. Explainability Output

Stored in `risk_assessments.factors` (jsonb) and rendered verbatim:

```json
{
  "level": "HIGH",
  "score": 61.4,
  "model_version": "rules-v0.1",
  "factors": [
    {"name": "hotspot_density_48h", "value": 14, "available": true,  "subscore": 82, "contribution": 28.7,
     "reason": "14 indikasi titik panas dalam 48 jam terakhir"},
    {"name": "rainfall_7d",         "value": 3.2, "available": true,  "subscore": 94, "contribution": 18.8,
     "reason": "Curah hujan 7 hari terakhir sangat rendah (3,2 mm)"},
    {"name": "humidity_24h",        "value": 46,  "available": true,  "subscore": 71, "contribution": 10.7,
     "reason": "Kelembapan rata-rata rendah (46%)"},
    {"name": "temperature_24h_max", "value": null, "available": false, "subscore": null, "contribution": 0,
     "reason": "Data suhu tidak tersedia"}
  ],
  "observed_window": {"from": "...", "to": "..."}
}
```

UI renders Observed values and Derived assessment in visually distinct sections.

## 5. Computation Cadence

Recomputed per kabupaten/kota after each relevant ingestion run (hotspots or weather) — event-driven within the worker, not per-request. Stored rows make history free and audits possible.

## 6. Calibration Plan

1. Ship v0.1 defaults with explicit "unvalidated" labeling.
2. After one dry+wet season of stored assessments + hotspot outcomes, backtest: do HIGH+ areas precede hotspot clusters more than LOW areas?
3. Adjust breakpoints/weights in config; bump `model_version`; keep old versions queryable for comparison.
4. Only after a backtested baseline exists may ML candidates (LR → RF/XGBoost/LightGBM) be trained and compared against it (precision/recall/F1/ROC-AUC, false negatives weighted heavily). Until then, **no "AI prediction" claims anywhere** (CORE RULES).

## 7. Future ML Interface (design-only, nothing built in MVP)

- `risk_assessments.model_version` already namespaces outputs → ML results coexist with rules baseline.
- Feature matrix is derivable purely from stored tables (hotspot aggregates, weather windows) → training script needs no new collection.
- Prediction horizons (24/48/72 h) would add `horizon` column + separate model_versions when that phase is genuinely reached.
