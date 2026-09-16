"""Unit tests for the rule-based fire-risk engine (no DB required)."""

import pytest

from app.risk import config as C
from app.risk.engine import (
    FactorInput,
    compute_aq_hazard,
    compute_risk,
    hotspot_reason,
    humidity_reason,
    level_for_score,
    normalize_factor,
    rainfall_reason,
    unavailable_reason,
)

# Docs §4 worked example, verbatim inputs (subscore/weight pairs + unavailable temp).
WORKED_FACTORS = [
    FactorInput(
        name="hotspot_density_48h",
        value=14,
        subscore=82,
        reason="14 indikasi titik panas dalam 48 jam terakhir",
    ),
    FactorInput(
        name="rainfall_7d",
        value=3.2,
        subscore=94,
        reason="Curah hujan 7 hari terakhir sangat rendah (3,2 mm)",
    ),
    FactorInput(
        name="humidity_24h",
        value=46,
        subscore=71,
        reason="Kelembapan rata-rata rendah (46%)",
    ),
    FactorInput(
        name="temperature_24h_max",
        value=None,
        reason="Data suhu tidak tersedia",
    ),
]


class TestWorkedExample:
    """Doctest-style verification of docs/risk-model.md §4 — must match exactly."""

    def test_score_and_level(self):
        result = compute_risk(WORKED_FACTORS)
        assert result.insufficient is False
        assert result.score == 83.1
        assert result.level == "very_high"
        assert result.level is not None and result.level.upper() == "VERY_HIGH"

    def test_contributions(self):
        result = compute_risk(WORKED_FACTORS)
        by_name = {f.name: f for f in result.factors}
        assert by_name["hotspot_density_48h"].contribution == 28.7
        assert by_name["rainfall_7d"].contribution == 18.8
        assert by_name["humidity_24h"].contribution == 10.65
        assert by_name["temperature_24h_max"].contribution == 0
        assert by_name["temperature_24h_max"].available is False

    def test_invariant(self):
        """score == Σ(contribution)/Σ(available weights) (docs §4 drift guard).

        NOTE: docs §3 prints a trailing ×100, but §4's own numbers
        (58.15 / 0.70 ⇒ 83.1) show the weighted mean is already 0-100;
        the example governs.
        """
        result = compute_risk(WORKED_FACTORS)
        assert result.score is not None
        total = sum(f.contribution for f in result.factors if f.available)
        weights = sum(C.WEIGHTS[f.name] for f in result.factors if f.available)
        assert weights == pytest.approx(0.70)
        assert result.score == pytest.approx(total / weights, abs=0.051)

    def test_factors_blob_shape(self):
        result = compute_risk(WORKED_FACTORS)
        blob = result.to_dict()
        assert blob["level"] == "VERY_HIGH"
        assert blob["score"] == 83.1
        assert blob["model_version"] == "rules-v0.1"
        assert {f["name"] for f in blob["factors"]} >= {
            "hotspot_density_48h",
            "rainfall_7d",
            "humidity_24h",
            "temperature_24h_max",
        }
        assert "observed_window" in blob


class TestGuards:
    def test_low_coverage_insufficient(self):
        """Single surviving factor (0.35 < 0.55) must not render a level."""
        result = compute_risk(
            [FactorInput(name="hotspot_density_48h", value=5.0, subscore=55, reason="x")]
        )
        assert result.insufficient is True
        assert result.level is None
        assert result.score is None
        # Factors still populated for explanation.
        assert len(result.factors) == len(C.WEIGHTS)

    def test_hotspot_missing_insufficient_despite_full_weather(self):
        result = compute_risk(
            [
                FactorInput(name="hotspot_density_48h", value=None, reason="Data hilang"),
                FactorInput(name="rainfall_7d", value=0.0, subscore=100, reason="x"),
                FactorInput(name="humidity_24h", value=30.0, subscore=100, reason="x"),
                FactorInput(name="temperature_24h_max", value=38.0, subscore=100, reason="x"),
                FactorInput(name="wind_24h_mean", value=40.0, subscore=100, reason="x"),
            ]
        )
        assert result.insufficient is True
        assert result.level is None

    def test_hotspot_entry_absent_insufficient(self):
        result = compute_risk(
            [FactorInput(name="rainfall_7d", value=0.0, subscore=100, reason="x")]
        )
        assert result.insufficient is True

    def test_empty_insufficient(self):
        result = compute_risk([])
        assert result.insufficient is True

    def test_contradictory_subscore_ignored(self):
        """value=None with a smuggled subscore stays unavailable (never fabricate)."""
        result = compute_risk(
            [
                FactorInput(name="hotspot_density_48h", value=None, subscore=99, reason="x"),
                FactorInput(name="rainfall_7d", value=0.0, subscore=100, reason="x"),
            ]
        )
        assert result.insufficient is True
        by_name = {f.name: f for f in result.factors}
        assert by_name["hotspot_density_48h"].available is False

    def test_unknown_factor_rejected(self):
        with pytest.raises(ValueError):
            compute_risk([FactorInput(name="moon_phase", value=1.0, reason="x")])

    def test_fuel_factor_when_provided(self):
        factors = list(WORKED_FACTORS) + [
            FactorInput(name="fuel_index", value=0.14, subscore=85, reason="Kadar air gambut rendah (0,14 m³/m³)")
        ]
        result = compute_risk(factors)
        fuel = next(f for f in result.factors if f.name == "fuel_index")
        assert fuel.available is True
        assert fuel.subscore == 85
        assert fuel.contribution == 8.5


class TestLevelBands:
    @pytest.mark.parametrize(
        ("score", "level"),
        [
            (0, "low"),
            (24, "low"),
            (25, "moderate"),
            (49, "moderate"),
            (50, "high"),
            (69, "high"),
            (70, "very_high"),
            (84, "very_high"),
            (85, "extreme"),
            (100, "extreme"),
        ],
    )
    def test_boundaries(self, score: float, level: str):
        assert level_for_score(score) == level


class TestNormalizeFactor:
    def test_unknown_factor(self):
        with pytest.raises(ValueError):
            normalize_factor("moon_phase", 1.0)

    def test_nodes_exact(self):
        assert normalize_factor("rainfall_7d", 50) == 0
        assert normalize_factor("rainfall_7d", 0) == 100
        assert normalize_factor("humidity_24h", 80) == 0
        assert normalize_factor("temperature_24h_max", 38) == 100

    def test_clamping_no_extrapolation(self):
        assert normalize_factor("rainfall_7d", 500) == 0
        assert normalize_factor("wind_24h_mean", 1000) == 100
        assert normalize_factor("hotspot_density_48h", -3) == 0

    def test_interpolation(self):
        # Rainfall midpoints: (5,90)-(10,70) at 7.5 -> 80.
        assert normalize_factor("rainfall_7d", 7.5) == 80
        # Humidity: (40,85)-(50,60) at 45 -> 72.5.
        assert normalize_factor("humidity_24h", 45) == 72.5

    def test_auto_normalize_when_subscore_omitted(self):
        result = compute_risk(
            [
                FactorInput(name="hotspot_density_48h", value=10.0, reason="x"),
                FactorInput(name="rainfall_7d", value=0.0, reason="x"),
                FactorInput(name="humidity_24h", value=30.0, reason="x"),
            ]
        )
        assert result.insufficient is False
        by_name = {f.name: f for f in result.factors}
        assert by_name["hotspot_density_48h"].subscore == 75
        assert by_name["rainfall_7d"].subscore == 100


class TestPerKm2Normalization:
    """Same hotspot count over different areas ⇒ different densities ⇒ different subscores."""

    def test_density_scales_with_area(self):
        count = 14
        small = count / 10.0  # 1.4/km2
        large = count / 100.0  # 0.14/km2
        assert normalize_factor("hotspot_density_48h", small) > normalize_factor(
            "hotspot_density_48h", large
        )

    def test_zero_count_is_valid_low(self):
        assert normalize_factor("hotspot_density_48h", 0.0) == 0


class TestReasons:
    def test_hotspot_reason_style(self):
        assert hotspot_reason(14) == "14 indikasi titik panas dalam 48 jam terakhir"

    def test_indonesian_decimal_comma(self):
        assert "3,2 mm" in rainfall_reason(3.2, 94)
        assert "46%" in humidity_reason(46, 71)

    def test_unavailable_reasons_bahasa(self):
        assert unavailable_reason("temperature_24h_max") == "Data suhu tidak tersedia"
        assert "tidak tersedia" in unavailable_reason("humidity_24h")


class TestConfigSanity:
    def test_weights_sum_to_one(self):
        assert sum(C.WEIGHTS.values()) == pytest.approx(1.0)

    def test_version(self):
        assert C.MODEL_VERSION == "rules-v0.1"

    def test_breakpoint_tables_sorted(self):
        for name, table in C.BREAKPOINTS.items():
            xs = [x for x, _ in table]
            assert xs == sorted(xs), name
            for _, y in table:
                assert 0 <= y <= 100, name


class TestAirQualityHazard:
    def test_none_handling(self):
        idx, label = compute_aq_hazard(None)
        assert idx is None
        assert label is None

    def test_baik_category(self):
        idx, label = compute_aq_hazard(12.0)
        assert label == "Baik"
        assert idx is not None and 0 <= idx <= 20.0

    def test_sedang_category(self):
        idx, label = compute_aq_hazard(35.0)
        assert label == "Sedang"
        assert idx is not None and 20.0 < idx <= 50.0

    def test_tidak_sehat_category(self):
        idx, label = compute_aq_hazard(75.0)
        assert label == "Tidak Sehat"
        assert idx is not None and 50.0 < idx <= 75.0

    def test_sangat_tidak_sehat_category(self):
        idx, label = compute_aq_hazard(180.0)
        assert label == "Sangat Tidak Sehat"
        assert idx is not None and 75.0 < idx <= 90.0

    def test_berbahaya_category(self):
        idx, label = compute_aq_hazard(300.0)
        assert label == "Berbahaya"
        assert idx is not None and idx > 90.0

    def test_dual_index_in_compute_risk(self):
        result = compute_risk(WORKED_FACTORS, pm25_value=68.5)
        assert result.fire_hazard_index == 83.1
        assert result.fire_risk_level == "Sangat Tinggi"
        assert result.air_quality_hazard_index is not None
        assert result.air_quality_level == "Tidak Sehat"
        assert result.pm25_value == 68.5
        d = result.to_dict()
        assert d["fire_hazard_index"] == 83.1
        assert d["air_quality_level"] == "Tidak Sehat"
