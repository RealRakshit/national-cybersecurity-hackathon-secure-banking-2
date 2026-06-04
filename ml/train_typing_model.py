from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

from typing_features import FEATURE_NAMES

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "model" / "typing_behavior_model.pkl"


def build_training_matrix(seed: int = 42) -> np.ndarray:
    rng = np.random.default_rng(seed)
    ordinary_shifts = rng.gamma(shape=1.35, scale=0.42, size=(4000, len(FEATURE_NAMES)))
    rare_corrections = rng.binomial(1, 0.08, ordinary_shifts.shape) * rng.uniform(
        0.2,
        0.9,
        ordinary_shifts.shape,
    )
    return np.clip(ordinary_shifts + rare_corrections, 0.0, 2.4)


def build_evaluation_matrix(seed: int = 84) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    normal_shifts = build_training_matrix(seed=seed)[:1000]
    suspicious_shifts = rng.uniform(2.7, 8.0, size=(1000, len(FEATURE_NAMES)))
    suspicious_shifts *= rng.uniform(0.55, 1.0, size=suspicious_shifts.shape)
    features = np.vstack((normal_shifts, suspicious_shifts))
    labels = np.concatenate((
        np.zeros(normal_shifts.shape[0], dtype=int),
        np.ones(suspicious_shifts.shape[0], dtype=int),
    ))
    return features, labels


def train_model() -> IsolationForest:
    model = IsolationForest(
        contamination=0.03,
        n_estimators=240,
        random_state=42,
    )
    return model.fit(build_training_matrix())


def evaluate_model(model: IsolationForest) -> dict[str, float]:
    features, labels = build_evaluation_matrix()
    predictions = (model.predict(features) == -1).astype(int)
    return {
        "accuracy": round(float(accuracy_score(labels, predictions)), 6),
        "precision": round(float(precision_score(labels, predictions, zero_division=0)), 6),
        "recall": round(float(recall_score(labels, predictions, zero_division=0)), 6),
        "f1": round(float(f1_score(labels, predictions, zero_division=0)), 6),
    }


def metrics_line(metrics: dict[str, float]) -> str:
    return " | ".join(f"{name}={value:.4f}" for name, value in metrics.items())


def export_model(model: IsolationForest, model_path: Path = MODEL_PATH) -> Path:
    model_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "training": "synthetic robust shifts around the user's five accepted login profiles",
        "evaluation": {
            "dataset": "synthetic held-out normal and suspicious robust-shift profiles",
            "metrics": evaluate_model(model),
        },
    }
    with model_path.open("wb") as model_file:
        pickle.dump(payload, model_file)
    return model_path


def main() -> None:
    model = train_model()
    model_path = export_model(model)
    metrics = evaluate_model(model)
    print(f"Exported typing behavior model to {model_path}")
    print(f"Synthetic evaluation metrics: {metrics_line(metrics)}")


if __name__ == "__main__":
    main()
