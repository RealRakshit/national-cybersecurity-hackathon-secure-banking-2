from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

from typing_features import FEATURE_NAMES, profile_shift_features

MODEL_PATH = Path(__file__).resolve().parent / "model" / "typing_behavior_model.pkl"


def load_payload() -> dict:
    with MODEL_PATH.open("rb") as model_file:
        payload = pickle.load(model_file)
    if tuple(payload.get("feature_names", ())) != FEATURE_NAMES:
        raise ValueError("Typing behavior model features do not match predictor features.")
    return payload


def predict(history: list[dict], candidate: dict) -> dict:
    payload = load_payload()
    features = profile_shift_features(history, candidate)
    model = payload["model"]
    label = int(model.predict(features)[0])
    score = float(model.decision_function(features)[0])
    return {
        "suspicious": label == -1,
        "score": round(score, 6),
        "features": dict(zip(FEATURE_NAMES, features[0].round(6).tolist())),
        "evaluation": payload.get("evaluation"),
    }


def print_evaluation(evaluation: dict | None) -> None:
    metrics = (evaluation or {}).get("metrics", {})
    if not metrics:
        return
    line = " | ".join(f"{name}={float(value):.4f}" for name, value in metrics.items())
    print(f"Synthetic evaluation metrics: {line}", file=sys.stderr)


def main() -> None:
    request = json.load(sys.stdin)
    result = predict(request["history"], request["candidate"])
    print_evaluation(result.get("evaluation"))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
