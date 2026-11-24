import argparse
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
import httpx
from dotenv import load_dotenv
from seeder import build_mock_bases

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("lws.worker")

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")
SCAN_SERVER_IDS = [
    int(s.strip())
    for s in os.getenv("SCAN_SERVER_IDS", "1349").split(",")
    if s.strip().isdigit()
]
SCAN_INTERVAL_SECONDS = int(os.getenv("SCAN_INTERVAL_SECONDS", "300"))
DEFAULT_WORKER_MODE = os.getenv("WORKER_MODE", "mock")


class RateLimitError(Exception):
    """Raised when the upstream map source returns HTTP 429."""


def fetch_bases(server_id: int, mode: str, now_utc: datetime) -> list[dict]:
    if mode == "mock":
        return build_mock_bases(now_utc, count=50)

    if mode == "external":
        raise NotImplementedError(
            "External adapter belum dikonfigurasi. "
            "Implementasikan fetch ke sumber scan Last War di sini."
        )

    raise ValueError(f"Unknown WORKER_MODE: {mode}")


def report_status(
    client: httpx.Client,
    server_id: int,
    status: str,
    error_message: str | None = None,
) -> None:
    try:
        res = client.post(
            f"{API_BASE_URL}/internal/scanner/status",
            json={
                "server_id": server_id,
                "status": status,
                "error_message": error_message,
            },
        )
        res.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning(
            "Gagal melaporkan status '%s' untuk server #%s: %s",
            status,
            server_id,
            exc,
        )


def run_scan_cycle(client: httpx.Client, server_id: int, mode: str) -> bool:
    logger.info("Memulai scan server #%s (mode=%s)...", server_id, mode)
    report_status(client, server_id, "scanning")

    try:
        now_utc = datetime.now(timezone.utc)
        bases = fetch_bases(server_id, mode, now_utc)

        res = client.post(
            f"{API_BASE_URL}/internal/ingest",
            json={
                "server_id": server_id,
                "scanned_at": now_utc.isoformat(),
                "bases": bases,
            },
        )
        res.raise_for_status()
        data = res.json()
        logger.info(
            "Scan selesai untuk server #%s: %s bases upserted.",
            server_id,
            data.get("upserted_count", 0),
        )
        return True

    except RateLimitError as exc:
        logger.warning("Rate limited pada server #%s: %s", server_id, exc)
        report_status(client, server_id, "rate_limited", str(exc))
        return False

    except Exception as exc:
        logger.error("Scan gagal untuk server #%s: %s", server_id, exc)
        report_status(client, server_id, "error", str(exc)[:300])
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="LWS Periodic Map Scanner Worker")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Jalankan 1 siklus scan lalu keluar (untuk testing).",
    )
    parser.add_argument(
        "--mode",
        choices=["mock", "external"],
        default=DEFAULT_WORKER_MODE,
        help="Sumber data scan (default: mock).",
    )
    args = parser.parse_args()

    if not INTERNAL_API_SECRET:
        raise RuntimeError("INTERNAL_API_SECRET belum diset di .env")

    headers = {"X-Internal-Secret": INTERNAL_API_SECRET}
    backoff_seconds = 30

    with httpx.Client(headers=headers, timeout=30.0) as client:
        while True:
            all_ok = True
            for server_id in SCAN_SERVER_IDS:
                ok = run_scan_cycle(client, server_id, args.mode)
                if not ok:
                    all_ok = False

            if args.once:
                break

            sleep_for = SCAN_INTERVAL_SECONDS if all_ok else backoff_seconds
            backoff_seconds = 30 if all_ok else min(backoff_seconds * 2, 600)
            logger.info("Menunggu %s detik sebelum siklus berikutnya...", sleep_for)
            time.sleep(sleep_for)


if __name__ == "__main__":
    main()