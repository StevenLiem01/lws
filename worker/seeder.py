import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
import httpx
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")
SERVER_ID = 1349

ALLIANCES = ["FRY", "KNG", "VEX", "NOVA", "IRON", None]
NAMES = [
    "WardenOfTheNorth",
    "IronVanguard",
    "ShadowReaper",
    "CrimsonWolf",
    "StormBreaker",
    "NightHawk",
    "FrostBite",
    "SolarFlare",
    "ValkyrieX",
    "TitanSlayer",
    "GhostRecon",
    "BlazeFury",
    "ApexHunter",
    "ObsidianKing",
    "CyberKnight",
]


def build_mock_bases(now_utc: datetime, count: int = 50) -> list[dict]:
    rng = random.Random(42)
    bases: list[dict] = []

    for i in range(count):
        uid = f"110903752500{1000 + i}"
        name = f"{NAMES[i % len(NAMES)]}_{i + 1}"
        alliance_tag = ALLIANCES[i % len(ALLIANCES)]
        hq_level = rng.randint(18, 30)
        x = rng.randint(50, 950)
        y = rng.randint(50, 950)

        if i < 20:
            is_shielded = False
            shield_expires_at = None
        elif i < 25:
            is_shielded = True
            shield_expires_at = (now_utc - timedelta(minutes=rng.randint(5, 60))).isoformat()
        elif i < 32:
            is_shielded = True
            shield_expires_at = (now_utc + timedelta(minutes=rng.randint(2, 14))).isoformat()
        elif i < 42:
            is_shielded = True
            shield_expires_at = (now_utc + timedelta(minutes=rng.randint(16, 58))).isoformat()
        else:
            is_shielded = True
            shield_expires_at = (now_utc + timedelta(hours=rng.randint(2, 8))).isoformat()

        bases.append(
            {
                "uid": uid,
                "name": name,
                "alliance_tag": alliance_tag,
                "hq_level": hq_level,
                "x": x,
                "y": y,
                "is_shielded": is_shielded,
                "shield_expires_at": shield_expires_at,
            }
        )

    return bases


def main() -> None:
    if not INTERNAL_API_SECRET:
        raise RuntimeError("INTERNAL_API_SECRET is not set in .env")

    now_utc = datetime.now(timezone.utc)
    payload = {
        "server_id": SERVER_ID,
        "scanned_at": now_utc.isoformat(),
        "bases": build_mock_bases(now_utc, count=50),
    }

    response = httpx.post(
        f"{API_BASE_URL}/internal/ingest",
        json=payload,
        headers={"X-Internal-Secret": INTERNAL_API_SECRET},
        timeout=30.0,
    )
    response.raise_for_status()
    print(response.json())


if __name__ == "__main__":
    main()