from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return a naive UTC timestamp for database compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
