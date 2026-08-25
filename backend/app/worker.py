"""Worker CLI for ingestion jobs."""

import argparse
import logging
import sys

from app.ingest import run_firms_hotspots
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

    return 0


if __name__ == "__main__":
    sys.exit(main())
