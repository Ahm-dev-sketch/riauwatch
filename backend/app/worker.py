"""Worker CLI for ingestion jobs."""

import argparse
import logging
import sys

from app.ingest import run_boundaries_load, run_firms_hotspots, run_open_meteo, run_openaq
from app.risk.recompute import run_risk_recompute
from app.settings import settings

# Configure structured JSON logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

logger = logging.getLogger(__name__)


def main() -> int:
    parser = argparse.ArgumentParser(description="RIAUWATCH ingestion worker")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # firms-hotspots subcommand
    firms_parser = subparsers.add_parser("firms-hotspots", help="Ingest FIRMS hotspots")
    firms_parser.add_argument(
        "--dry-run", action="store_true", help="Fetch and validate only, do not store"
    )

    # weather-points subcommand
    weather_parser = subparsers.add_parser("weather-points", help="Ingest Open-Meteo weather points")
    weather_parser.add_argument(
        "--past-days", type=int, default=None, help="Number of past days to fetch (default from settings)"
    )
    weather_parser.add_argument(
        "--forecast-days", type=int, default=None, help="Number of forecast days to fetch (default from settings)"
    )

    # air-quality subcommand
    _ = subparsers.add_parser("air-quality", help="Ingest OpenAQ air quality data")

    # boundaries-load subcommand
    boundaries_parser = subparsers.add_parser("boundaries-load", help="Load geoBoundaries administrative areas")
    boundaries_parser.add_argument(
        "--file", type=str, required=True, help="Path to GeoJSON file"
    )

    # risk-recompute subcommand
    _ = subparsers.add_parser("risk-recompute", help="Recompute rule-based fire risk")

    args = parser.parse_args()

    if args.command == "firms-hotspots":
        logger.info("Starting FIRMS hotspots ingestion")
        try:
            run_firms_hotspots()
            logger.info("FIRMS hotspots ingestion completed")
            return 0
        except Exception as e:
            logger.exception("FIRMS hotspots ingestion failed: %s", e)
            return 1

    elif args.command == "weather-points":
        logger.info("Starting Open-Meteo weather ingestion")
        try:
            run_open_meteo(past_days=args.past_days, forecast_days=args.forecast_days)
            logger.info("Open-Meteo weather ingestion completed")
            return 0
        except Exception as e:
            logger.exception("Open-Meteo weather ingestion failed: %s", e)
            return 1

    elif args.command == "air-quality":
        logger.info("Starting OpenAQ air quality ingestion")
        try:
            run_openaq()
            logger.info("OpenAQ air quality ingestion completed")
            return 0
        except Exception as e:
            logger.exception("OpenAQ air quality ingestion failed: %s", e)
            return 1

    elif args.command == "boundaries-load":
        logger.info("Starting boundaries load from %s", args.file)
        try:
            run_boundaries_load(args.file)
            logger.info("Boundaries load completed")
            return 0
        except Exception as e:
            logger.exception("Boundaries load failed: %s", e)
            return 1

    elif args.command == "risk-recompute":
        logger.info("Starting risk recompute")
        try:
            summary = run_risk_recompute()
            logger.info("Risk recompute completed: %s", summary)
            return 0
        except Exception as e:
            logger.exception("Risk recompute failed: %s", e)
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
