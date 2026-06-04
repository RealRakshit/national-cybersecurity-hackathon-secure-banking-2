from __future__ import annotations

from statistics import median
from typing import Iterable

import numpy as np

FEATURE_NAMES = (
    "wpm_shift",
    "key_hold_shift",
    "key_delay_shift",
    "backspace_shift",
)
PROFILE_FIELDS = (
    "wpm",
    "keyHoldTimeMs",
    "keyDelayMs",
    "backspaceCount",
)
MINIMUM_SCALES = {
    "wpm": 8.0,
    "keyHoldTimeMs": 18.0,
    "keyDelayMs": 25.0,
    "backspaceCount": 1.0,
}


def _numeric_values(profiles: Iterable[dict], field: str) -> list[float]:
    values = [float(profile[field]) for profile in profiles]
    if len(values) < 5 or not all(np.isfinite(value) for value in values):
        raise ValueError("Five finite typing profiles are required.")
    return values


def _robust_scale(values: list[float], field: str) -> float:
    center = median(values)
    absolute_deviations = [abs(value - center) for value in values]
    median_absolute_deviation = median(absolute_deviations) * 1.4826
    natural_scale = abs(center) * (0.18 if field != "backspaceCount" else 0.0)
    return max(median_absolute_deviation, natural_scale, MINIMUM_SCALES[field])


def profile_shift_features(history: list[dict], candidate: dict) -> np.ndarray:
    shifts = []
    for field in PROFILE_FIELDS:
        values = _numeric_values(history, field)
        candidate_value = float(candidate[field])
        if not np.isfinite(candidate_value):
            raise ValueError("Candidate typing profile must be finite.")
        shifts.append(abs(candidate_value - median(values)) / _robust_scale(values, field))
    return np.asarray(shifts, dtype=float).reshape(1, -1)
