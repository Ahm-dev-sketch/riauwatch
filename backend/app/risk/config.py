"""All tunables for the rule-based fire-risk model v0.1 (single place).

Authoritative source: docs/risk-model.md. Recalibration = edit this file only;
``model_version`` must be bumped whenever weights/bands/breakpoints change so old
outputs stay comparable.

Format choice: plain Python module (not YAML) — zero new dependencies, mypy-checked,
importable by both the worker job and unit tests. A YAML loader would add a parser
dependency for no functional gain at this scale.
"""

# Namespaces stored rows; bump on any tunable change.
MODEL_VERSION = "rules-v0.1"

# Prediction horizon for current-condition assessments.
HORIZON = "current"

# Per-factor weights (engineering defaults, NOT scientific constants).
# Fuel stays reserved: no valid dataset adopted — never proxied by invented values.
WEIGHTS: dict[str, float] = {
    "hotspot_density_48h": 0.35,
    "rainfall_7d": 0.20,
    "humidity_24h": 0.15,
    "temperature_24h_max": 0.10,
    "wind_24h_mean": 0.10,
    "fuel_index": 0.10,  # reserved; hardcoded unavailable (see FUEL_AVAILABLE)
}

# Fuel/dryness indicator: config-present but hardcoded unavailable until a valid
# dataset (e.g. peatland map, rainfall climatology) is adopted.
FUEL_AVAILABLE = False

# Guard 1: minimum sum of available weights, else INSUFFICIENT_DATA.
COVERAGE_FLOOR = 0.55

# MODIS detections count toward hotspot density only when confidence_value >= this.
MODIS_CONFIDENCE_THRESHOLD = 30

# Hotspot observation window (hours) and density denominator handling.
HOTSPOT_LOOKBACK_HOURS = 48

# Hotspot counts are trusted only when a successful FIRMS run finished within this
# many hours; otherwise the density factor is reported unavailable (a number without
# the primary observed signal would be misleading by definition).
HOTSPOT_STALE_AFTER_HOURS = 6

# Level bands as (inclusive lower bound, level); evaluated highest-first.
# Canonical level names are lowercase (match the risk_assessments CHECK constraint);
# the factors JSON blob carries the UPPERCASE display form per docs/risk-model.md §4.
LEVEL_BANDS: list[tuple[float, str]] = [
    (85, "extreme"),
    (70, "very_high"),
    (50, "high"),
    (25, "moderate"),
    (0, "low"),
]

# Piecewise-linear breakpoint tables: observed value -> 0-100 subscore.
# Nodes ascending in x; values outside the table clamp to the nearest endpoint.
# Initial meteorological reasoning per table; calibration targets, not constants.
BREAKPOINTS: dict[str, list[tuple[float, float]]] = {
    # Hotspots per km2, last 48h (more -> riskier). Diminishing returns past ~10/km2:
    # a landscape already saturated with detections cannot get much worse.
    "hotspot_density_48h": [
        (0, 0),
        (1, 20),
        (3, 40),
        (6, 60),
        (10, 75),
        (15, 85),
        (25, 95),
        (40, 100),
    ],
    # Accumulated precipitation, last 7d in mm (less -> riskier).
    # Anchors: >=50 mm saturates fuels (~0); <=5 mm is effectively dry (~90+).
    "rainfall_7d": [
        (0, 100),
        (5, 90),
        (10, 70),
        (20, 40),
        (35, 15),
        (50, 0),
    ],
    # Mean relative humidity, last 24h in % (lower -> riskier).
    # Riau ambient sits ~80%; sustained means below ~50% mark real drying.
    "humidity_24h": [
        (30, 100),
        (40, 85),
        (50, 60),
        (60, 35),
        (70, 15),
        (80, 0),
    ],
    # Max temperature, last 24h in C (higher -> riskier).
    "temperature_24h_max": [
        (25, 0),
        (28, 15),
        (30, 35),
        (32, 60),
        (34, 80),
        (36, 95),
        (38, 100),
    ],
    # Mean wind speed, last 24h in km/h (stronger -> spread riskier).
    "wind_24h_mean": [
        (0, 0),
        (5, 10),
        (10, 30),
        (15, 50),
        (20, 70),
        (30, 90),
        (40, 100),
    ],
}

# Indonesian reason strings for unavailable factors (rendered verbatim by the UI).
UNAVAILABLE_REASONS: dict[str, str] = {
    "hotspot_density_48h": "Data titik panas tidak tersedia",
    "rainfall_7d": "Data curah hujan tidak tersedia",
    "humidity_24h": "Data kelembapan tidak tersedia",
    "temperature_24h_max": "Data suhu tidak tersedia",
    "wind_24h_mean": "Data angin tidak tersedia",
    "fuel_index": "Indikator bahan bakar belum tersedia (menunggu dataset yang valid)",
}
