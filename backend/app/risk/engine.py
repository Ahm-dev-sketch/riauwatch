"""Pure rule-based fire-risk scoring (DB-free, fully unit-testable).

Implements docs/risk-model.md §3: renormalized weighted mean over available factors,
two INSUFFICIENT_DATA guards, config-driven level bands. Missing factors are excluded
and weights renormalized — never zero-filled, never interpolated, never fabricated.
"""

from dataclasses import dataclass, field
from datetime import datetime

from app.risk import config as C


@dataclass
class FactorInput:
    """One factor as handed to the scorer.

    Available factors carry ``value`` (observed) and either a precomputed ``subscore``
    (0-100) or ``None`` to normalize from breakpoints here. Unavailable factors carry
    ``value=None`` (any passed subscore is ignored — never fabricate) plus a reason.
    """

    name: str
    value: float | None
    subscore: float | None = None
    reason: str = ""


@dataclass
class FactorResult:
    """One factor as stored/rendered (docs/risk-model.md §4 shape)."""

    name: str
    value: float | None
    available: bool
    subscore: float | None
    contribution: float
    reason: str


@dataclass
class RiskResult:
    """Scoring outcome. ``level`` is DB-canonical lowercase (or None when insufficient)."""

    level: str | None
    score: float | None
    factors: list[FactorResult] = field(default_factory=list)
    insufficient: bool = False
    observed_from: datetime | None = None
    observed_to: datetime | None = None

    def to_dict(self) -> dict:
        """Factors JSON blob stored in risk_assessments.factors (docs §4 shape)."""
        return {
            "level": self.level.upper() if self.level else None,
            "score": self.score,
            "model_version": C.MODEL_VERSION,
            "factors": [
                {
                    "name": f.name,
                    "value": f.value,
                    "available": f.available,
                    "subscore": f.subscore,
                    "contribution": f.contribution,
                    "reason": f.reason,
                }
                for f in self.factors
            ],
            "observed_window": {
                "from": self.observed_from.isoformat() if self.observed_from else None,
                "to": self.observed_to.isoformat() if self.observed_to else None,
            },
        }


def normalize_factor(name: str, observed_value: float) -> float:
    """Map an observed value to a 0-100 subscore via breakpoint interpolation.

    Raises ValueError for unknown factor names. Values outside the table clamp to
    the nearest endpoint (no extrapolation).
    """
    try:
        table = C.BREAKPOINTS[name]
    except KeyError:
        raise ValueError(f"unknown risk factor: {name!r}") from None
    if observed_value <= table[0][0]:
        return float(table[0][1])
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if observed_value <= x1:
            span = x1 - x0
            subscore = y0 if span == 0 else y0 + (observed_value - x0) / span * (y1 - y0)
            return round(float(subscore), 1)
    return float(table[-1][1])


def level_for_score(score: float) -> str:
    """Map a 0-100 score to its canonical lowercase level."""
    for bound, level in C.LEVEL_BANDS:
        if score >= bound:
            return level
    return "low"  # unreachable (bands bottom out at 0) but total


def _descriptor(subscore: float, words: tuple[str, str, str, str]) -> str:
    """Pick an Indonesian intensity word from a subscore (very/high/mid/low)."""
    if subscore >= 80:
        return words[0]
    if subscore >= 50:
        return words[1]
    if subscore >= 25:
        return words[2]
    return words[3]


def _fmt_id(value: float) -> str:
    """Format a number Indonesian-style (comma decimal separator, e.g. 3,2)."""
    text = f"{value:g}"
    return text.replace(".", ",")


def hotspot_reason(count: int) -> str:
    """Bahasa Indonesia reason for the hotspot density factor (§4 style)."""
    return f"{count} indikasi titik panas dalam 48 jam terakhir"


def rainfall_reason(mm: float, subscore: float) -> str:
    """Bahasa Indonesia reason for the 7-day rainfall factor (§4 style)."""
    word = _descriptor(subscore, ("sangat rendah", "rendah", "sedang", "tinggi"))
    return f"Curah hujan 7 hari terakhir {word} ({_fmt_id(mm)} mm)"


def humidity_reason(rh: float, subscore: float) -> str:
    """Bahasa Indonesia reason for the 24h mean humidity factor (§4 style)."""
    word = _descriptor(subscore, ("sangat rendah", "rendah", "sedang", "tinggi"))
    return f"Kelembapan rata-rata {word} ({_fmt_id(rh)}%)"


def temperature_reason(temp_c: float, subscore: float) -> str:
    """Bahasa Indonesia reason for the 24h max temperature factor."""
    word = _descriptor(subscore, ("sangat tinggi", "tinggi", "sedang", "normal"))
    return f"Suhu maksimum {word} ({_fmt_id(temp_c)}°C)"


def wind_reason(kmh: float, subscore: float) -> str:
    """Bahasa Indonesia reason for the 24h mean wind factor."""
    word = _descriptor(subscore, ("sangat kencang", "kencang", "sedang", "pelan"))
    return f"Kecepatan angin rata-rata {word} ({_fmt_id(kmh)} km/jam)"


def fuel_reason(soil_moisture: float, subscore: float) -> str:
    """Bahasa Indonesia reason for the fuel index / soil moisture factor."""
    sm_str = _fmt_id(soil_moisture)
    if subscore >= 80:
        return f"Kadar air gambut sangat rendah ({sm_str} m³/m³ — lapisan atas sangat kering & mudah terbakar)"
    if subscore >= 55:
        return f"Kadar air gambut rendah ({sm_str} m³/m³ — lapisan tanah cukup kering)"
    if subscore >= 25:
        return f"Kadar air gambut sedang ({sm_str} m³/m³ — cukup lembap)"
    return f"Kadar air gambut optimal ({sm_str} m³/m³ — basah & aman)"


def unavailable_reason(name: str) -> str:
    """Bahasa Indonesia reason for an unavailable factor."""
    return C.UNAVAILABLE_REASONS.get(name, f"Data {name} tidak tersedia")


def compute_risk(
    factors: list[FactorInput],
    *,
    observed_from: datetime | None = None,
    observed_to: datetime | None = None,
) -> RiskResult:
    """Score one area from its factors."""
    by_name = {f.name: f for f in factors}
    for name in by_name:
        if name not in C.WEIGHTS:
            raise ValueError(f"unknown risk factor: {name!r}")

    results: list[FactorResult] = []
    for name, weight in C.WEIGHTS.items():
        if name == "fuel_index" and not C.FUEL_AVAILABLE:
            results.append(
                FactorResult(
                    name=name,
                    value=None,
                    available=False,
                    subscore=None,
                    contribution=0.0,
                    reason=C.UNAVAILABLE_REASONS[name],
                )
            )
            continue
        entry = by_name.get(name)
        if entry is None or entry.value is None:
            results.append(
                FactorResult(
                    name=name,
                    value=None,
                    available=False,
                    subscore=None,
                    contribution=0.0,
                    reason=entry.reason if entry and entry.reason else unavailable_reason(name),
                )
            )
            continue
        subscore = entry.subscore if entry.subscore is not None else normalize_factor(name, entry.value)
        results.append(
            FactorResult(
                name=name,
                value=entry.value,
                available=True,
                subscore=subscore,
                contribution=round(subscore * weight, 2),
                reason=entry.reason,
            )
        )

    hotspot = next((r for r in results if r.name == "hotspot_density_48h"), None)
    available_weight = sum(C.WEIGHTS[r.name] for r in results if r.available)
    if hotspot is None or not hotspot.available or available_weight < C.COVERAGE_FLOOR:
        return RiskResult(
            level=None,
            score=None,
            factors=results,
            insufficient=True,
            observed_from=observed_from,
            observed_to=observed_to,
        )

    total = sum(r.contribution for r in results if r.available)
    score = round(total / available_weight, 1)
    return RiskResult(
        level=level_for_score(score),
        score=score,
        factors=results,
        insufficient=False,
        observed_from=observed_from,
        observed_to=observed_to,
    )
