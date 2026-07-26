"""Shared SQLAlchemy type helpers."""

from __future__ import annotations

from collections.abc import Iterable


def enum_values(enum_cls: type) -> list[str]:
    """Return the persisted values for a Python Enum class."""
    return [member.value for member in enum_cls]


def enum_value_renames(
    existing_labels: Iterable[str],
    desired_labels: Iterable[str],
) -> list[tuple[str, str]]:
    """Return label rename pairs that normalize legacy enum labels.

    The database may contain legacy uppercase labels while the application
    now expects lowercase values. This helper returns only the safe renames:
    labels that case-fold to a desired value and do not already exist in the
    target form.
    """

    existing = list(existing_labels)
    desired = list(desired_labels)
    desired_lookup = {label.lower(): label for label in desired}
    existing_set = set(existing)

    renames: list[tuple[str, str]] = []
    for label in existing:
        normalized = label.lower()
        target = desired_lookup.get(normalized)
        if not target or label == target or target in existing_set:
            continue
        renames.append((label, target))

    return renames
