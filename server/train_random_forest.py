#!/usr/bin/env python3
"""
Train a Random Forest to predict final UUT status from step-level data.
Adds (1) step result richness & position features and (2) order/sequence bigram features.
Also AUTO-CLEANS the output directory at the start of each run to avoid stale splits/artifacts.

Usage:
  python train_random_forest.py \
      --db ./test_results.db \
      --outdir ./ml_artifacts \
      --target pass_binary \
      --bigram_top_k 50
"""

import argparse
import json
import os
import re
import shutil
import sqlite3
import warnings
from typing import List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight


# ---------------------------
# Args / utils
# ---------------------------

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--db", type=str, default="./test_results.db", help="Path to SQLite database file")
    p.add_argument("--outdir", type=str, default="./ml_artifacts", help="Directory to write outputs")
    p.add_argument("--target", type=str, default="pass_binary", choices=["pass_binary", "multiclass"], help="Target label type")
    p.add_argument("--test_size", type=float, default=0.2, help="Test size fraction")
    p.add_argument("--random_state", type=int, default=42, help="Random seed")
    p.add_argument("--n_estimators", type=int, default=300, help="Number of trees in the forest")
    p.add_argument("--n_top_features", type=int, default=50, help="How many top features to export")
    p.add_argument("--bigram_top_k", type=int, default=50, help="Top-K FAIL bigrams to include as features")
    return p.parse_args()


def sanitize(name: str) -> str:
    return re.sub(r"[^0-9a-zA-Z]+", "_", str(name)).strip("_").lower()


def load_tables(db_path: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    con = sqlite3.connect(db_path)
    gm = pd.read_sql("SELECT * FROM global_metadata", con)
    sd = pd.read_sql("SELECT * FROM step_data", con)
    con.close()
    return gm, sd


def coerce_time_cols(df: pd.DataFrame) -> pd.DataFrame:
    for col in ["testStarted", "testStopped"]:
        if col in df.columns:
            # Typical format 'YYYY/MM/DD HH:MM:SS'
            df[col] = pd.to_datetime(df[col], errors="coerce", format="%Y/%m/%d %H:%M:%S")
    return df


def collapse_duplicate_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    If df has duplicate column labels (e.g., stepName sanitization collisions), collapse them by summing.
    """
    if getattr(df.columns, "is_unique", True):
        return df
    # transpose -> groupby label -> sum -> transpose back
    return df.T.groupby(level=0).sum().T


# ---------------------------
# Feature engineering (richness/position + sequences)
# ---------------------------

def build_base_features(
    gm: pd.DataFrame,
    sd: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.Series, pd.Series, pd.DataFrame]:
    """
    Build all features EXCEPT the (train-only) top-K bigram indicators.
    Returns:
      X_base: DataFrame indexed by global_id
      y_bin: binary target (PASS=1 else 0)
      y_multi: multiclass target
      fail_seq_df: DataFrame [global_id, fail_sequence(list of stepNames in order)]
    """
    gm = gm.copy()
    sd = sd.copy()

    # Targets
    if "uutStatus" not in gm.columns:
        raise ValueError("global_metadata.uutStatus not found")
    y_bin = (gm["uutStatus"].astype(str).str.upper() == "PASS").astype(int)
    y_multi = gm["uutStatus"].astype("category")

    # Meta time features
    gm = coerce_time_cols(gm)
    if {"testStarted", "testStopped"}.issubset(gm.columns):
        gm["test_duration_sec"] = (gm["testStopped"] - gm["testStarted"]).dt.total_seconds()
        gm["start_hour"] = gm["testStarted"].dt.hour
        gm["start_weekday"] = gm["testStarted"].dt.weekday
    else:
        gm["test_duration_sec"] = np.nan
        gm["start_hour"] = np.nan
        gm["start_weekday"] = np.nan

    # Step data cleaning
    sd["stepResult"] = sd["stepResult"].astype(str).str.upper()
    sd["stepName"] = sd["stepName"].fillna("UNKNOWN")
    sd["stepNumber_num"] = pd.to_numeric(sd.get("stepNumber"), errors="coerce")
    sd["measureValue_num"] = pd.to_numeric(sd.get("measureValue"), errors="coerce")

    # --- (1) Step result richness ---

    # 1.a per stepName × stepResult counts: cnt_<RES>__<step>
    step_result_counts = (
        sd.pivot_table(index="global_id", columns=["stepName", "stepResult"], values="id", aggfunc="count", fill_value=0)
          .sort_index(axis=1)
    )
    step_result_counts.columns = [
        f"cnt_{res}__{sanitize(name)}" for (name, res) in step_result_counts.columns
    ]
    step_result_counts = step_result_counts.reset_index()

    # 1.b Position buckets (early/mid/late by per-session quantiles of stepNumber)
    q = sd.groupby("global_id")["stepNumber_num"].quantile([0.33, 0.66]).unstack()
    q.columns = ["q33", "q66"]
    sd = sd.merge(q, on="global_id", how="left")
    sd["pos_bucket"] = np.where(
        sd["stepNumber_num"] <= sd["q33"], "early",
        np.where(sd["stepNumber_num"] <= sd["q66"], "mid", "late")
    )

    bucket_counts = (
        sd.pivot_table(index="global_id", columns=["pos_bucket", "stepResult"], values="id", aggfunc="count", fill_value=0)
    )
    bucket_counts.columns = [f"cnt_{b}_{res}" for (b, res) in bucket_counts.columns]
    bucket_counts = bucket_counts.reset_index()

    # 1.c Fail position stats per session
    fail_rows = sd[sd["stepResult"] == "FAIL"].copy()
    first_fail = fail_rows.groupby("global_id")["stepNumber_num"].min().rename("first_fail_stepnum")
    last_fail = fail_rows.groupby("global_id")["stepNumber_num"].max().rename("last_fail_stepnum")
    fail_span = (last_fail - first_fail).rename("fail_step_span")

    # Number of contiguous FAIL clusters in step order
    def count_fail_clusters(g: pd.DataFrame) -> int:
        g = g.sort_values("stepNumber_num")
        prev = g["stepNumber_num"].shift(1)
        new_cluster = (prev.isna()) | (g["stepNumber_num"] != prev + 1)
        return int(new_cluster.sum())

    fail_clusters = (
        fail_rows.sort_values(["global_id", "stepNumber_num"])
                 .groupby("global_id")
                 .apply(count_fail_clusters)
                 .rename("fail_clusters")
                 .to_frame()
                 .reset_index()
    )

    pos_feats = (
        pd.concat([first_fail, last_fail, fail_span], axis=1)
          .reset_index()
          .merge(fail_clusters, on="global_id", how="left")
    )

    # Simpler aggregates kept from your baseline
    result_counts = (
        sd.pivot_table(index="global_id", columns="stepResult", values="id", aggfunc="count", fill_value=0)
          .add_prefix("count_")
          .reset_index()
    )
    total_steps = sd.groupby("global_id")["id"].count().rename("total_steps").reset_index()

    # Numeric stats (from baseline)
    num_stats = sd.groupby("global_id")["measureValue_num"].agg(
        mean_measureValue="mean",
        std_measureValue="std",
        min_measureValue="min",
        max_measureValue="max",
        q25_measureValue=lambda s: s.quantile(0.25),
        q75_measureValue=lambda s: s.quantile(0.75),
        n_numeric=lambda s: s.notna().sum(),
    ).reset_index()

    # Step time (if exists)
    if "stepTime" in sd.columns:
        sd["stepTime_num"] = pd.to_numeric(sd["stepTime"], errors="coerce")
        time_stats = sd.groupby("global_id")["stepTime_num"].agg(
            mean_stepTime="mean",
            std_stepTime="std",
        ).reset_index()
    else:
        time_stats = pd.DataFrame({
            "global_id": sd["global_id"].unique(),
            "mean_stepTime": np.nan,
            "std_stepTime": np.nan
        })

    # Any-fail by stepName (from baseline)
    any_fail = (
        sd.assign(is_fail=(sd["stepResult"] == "FAIL").astype(int))
          .groupby(["global_id", "stepName"])["is_fail"].max()
          .unstack(fill_value=0)
    )
    any_fail.columns = [f"fail_any__{sanitize(c)}" for c in any_fail.columns]
    any_fail = any_fail.reset_index()

    # --- (2) FAIL step sequences (for bigrams later) ---
    fail_seq = (
        sd[sd["stepResult"] == "FAIL"]
          .sort_values(["global_id", "stepNumber_num"])
          .groupby("global_id")["stepName"].apply(list)
          .rename("fail_sequence")
          .reset_index()
    )

    # Join all step-derived features (excluding bigram indicators)
    features = (
        total_steps
          .merge(result_counts, on="global_id", how="left")
          .merge(step_result_counts, on="global_id", how="left")
          .merge(bucket_counts, on="global_id", how="left")
          .merge(pos_feats, on="global_id", how="left")
          .merge(any_fail, on="global_id", how="left")
          .merge(num_stats, on="global_id", how="left")
          .merge(time_stats, on="global_id", how="left")
    ).fillna(0)

    # Meta join
    gm_ren = gm.rename(columns={"id": "global_id"})
    meta_cols = ["global_id", "machineIdentifier", "stationName", "Testspec", "AteSwVersion",
                 "test_duration_sec", "start_hour", "start_weekday"]
    meta = gm_ren[[c for c in meta_cols if c in gm_ren.columns]]
    df = meta.merge(features, on="global_id", how="left")

    # One-hot categorical meta
    cat_cols = [c for c in ["machineIdentifier", "stationName", "Testspec", "AteSwVersion"] if c in df.columns]
    df = pd.get_dummies(df, columns=cat_cols, dummy_na=True)

    # Clean
    df = df.fillna(0).set_index("global_id")

    # Ensure unique feature axis (avoid reindex issues later)
    df = collapse_duplicate_columns(df)

    return df, y_bin, y_multi, fail_seq  # fail_seq has global_id + fail_sequence(list)


def pairs_from_sequence(seq: List[str]) -> List[Tuple[str, str]]:
    """Build ordered bigrams from a list of stepNames."""
    return [(seq[i], seq[i + 1]) for i in range(len(seq) - 1)] if isinstance(seq, list) else []


def top_k_bigrams_from_train(fail_seq_train: pd.Series, k: int) -> List[Tuple[str, str]]:
    """Count FAIL bigrams within the training split and return top-K pairs."""
    from collections import Counter
    ctr = Counter()
    for seq in fail_seq_train.dropna().tolist():  # NaNs -> no sequence
        ctr.update(pairs_from_sequence(seq))
    # Sort by count desc, then lexicographically for stability
    items = sorted(ctr.items(), key=lambda x: (-x[1], x[0]))
    return [p for (p, _) in items[:k]]


def build_bigram_features(fail_seq_series: pd.Series, bigram_vocab: List[Tuple[str, str]]) -> pd.DataFrame:
    """
    Given a Series indexed by global_id with list-of-steps per session,
    produce binary indicator columns for each pair in bigram_vocab.
    """
    if not bigram_vocab:
        return pd.DataFrame(index=fail_seq_series.index)

    rows = []
    ids = []
    for gid, seq in fail_seq_series.items():
        ids.append(gid)
        seq_pairs = set(pairs_from_sequence(seq)) if isinstance(seq, list) else set()
        row = [int(p in seq_pairs) for p in bigram_vocab]
        rows.append(row)
    cols = [f"pairFAIL__{sanitize(a)}__then__{sanitize(b)}" for (a, b) in bigram_vocab]
    out = pd.DataFrame(rows, columns=cols, index=ids).sort_index()
    return out


# ---------------------------
# Training
# ---------------------------

def clean_outdir(outdir: str):
    """
    AUTO-CLEAN: remove previous artifacts to avoid stale splits/feature schemas.
    """
    if os.path.isdir(outdir):
        print(f"[CLEAN] Removing previous artifacts in: {outdir}")
        # safer: remove contents only
        for name in os.listdir(outdir):
            p = os.path.join(outdir, name)
            try:
                if os.path.isdir(p) and not os.path.islink(p):
                    shutil.rmtree(p)
                else:
                    os.unlink(p)
            except Exception as e:
                print(f"[CLEAN][WARN] Failed to remove {p}: {e}")
    os.makedirs(outdir, exist_ok=True)


def main():
    args = parse_args()

    # AUTO-CLEAN the output directory at the start of each run
    clean_outdir(args.outdir)

    print(f"Loading tables from {args.db}...")
    gm, sd = load_tables(args.db)
    print(f"global_metadata: {len(gm)} rows, step_data: {len(sd)} rows")

    # Base features + sequences
    X_base, y_bin, y_multi, fail_seq_df = build_base_features(gm, sd)

    # Build a Series of sequences and ALIGN it to ALL sessions so loc[...] won't KeyError
    fail_seq_series = fail_seq_df.set_index("global_id")["fail_sequence"]
    fail_seq_series = fail_seq_series.reindex(X_base.index)  # missing sessions -> NaN

    # Align label indices
    y_bin = pd.Series(y_bin.values, index=X_base.index, name="pass_binary")
    y_multi = pd.Series(y_multi.values, index=X_base.index, name="uutStatus")

    # Choose target
    y = y_bin if args.target == "pass_binary" else y_multi

    # Split
    X_train_base, X_test_base, y_train, y_test = train_test_split(
        X_base, y, test_size=args.test_size, random_state=args.random_state, stratify=y
    )
    train_ids = X_train_base.index
    test_ids = X_test_base.index

    # (2) Learn top-K bigrams on TRAIN ONLY and build features for both splits
    print(f"Building FAIL bigram features (top_k={args.bigram_top_k}) from training split...")
    top_bigrams = top_k_bigrams_from_train(fail_seq_series.loc[train_ids], k=args.bigram_top_k)

    # Save bigram vocab so predict can mirror these features later
    bigram_art = os.path.join(args.outdir, "top_fail_bigrams.json")
    with open(bigram_art, "w") as f:
        json.dump([{"prev": a, "next": b} for (a, b) in top_bigrams], f, indent=2)
    print(f"Saved bigram vocabulary to {bigram_art} (count={len(top_bigrams)})")

    # Build bigram indicator matrices, align to same column order
    big_train = build_bigram_features(fail_seq_series.loc[train_ids], top_bigrams)
    big_test = build_bigram_features(fail_seq_series.loc[test_ids], top_bigrams)

    # Combine base + bigram features
    X_train = X_train_base.join(big_train, how="left").fillna(0)
    X_test = X_test_base.join(big_test, how="left").fillna(0)

    # Just in case: ensure no duplicate columns after joins
    X_train = collapse_duplicate_columns(X_train)
    X_test = collapse_duplicate_columns(X_test)

    # Class weights (binary)
    class_weight = None
    if args.target == "pass_binary":
        classes = np.unique(y_train)
        cw = compute_class_weight(class_weight="balanced", classes=classes, y=y_train)
        class_weight = {int(c): float(w) for c, w in zip(classes, cw)}
        print("Class weights:", class_weight)

    # Train RF
    rf = RandomForestClassifier(
        n_estimators=args.n_estimators,
        max_depth=None,
        min_samples_split=2,
        min_samples_leaf=1,
        n_jobs=-1,
        random_state=args.random_state,
        class_weight=class_weight
    )

    print("Training RandomForest...")
    rf.fit(X_train, y_train)

    # Evaluate
    print("\n=== Evaluation ===")
    y_pred = rf.predict(X_test)
    print(classification_report(y_test, y_pred, digits=4))
    print("Confusion matrix:\n", confusion_matrix(y_test, y_pred))

    if args.target == "pass_binary":
        try:
            y_proba = rf.predict_proba(X_test)[:, 1]
            roc = roc_auc_score(y_test, y_proba)
            print(f"ROC AUC: {roc:.4f}")
        except Exception as e:
            print("Could not compute ROC AUC:", e)

    # Feature importances
    fi = pd.DataFrame({
        "feature": X_train.columns,
        "importance": rf.feature_importances_
    }).sort_values("importance", ascending=False)
    topn = fi.head(args.n_top_features)

    # Save model
    model_path = os.path.join(args.outdir, f"random_forest_{args.target}.joblib")
    joblib.dump(rf, model_path)
    print(f"Saved model to {model_path}")

    # Save feature importances
    fi_path = os.path.join(args.outdir, "feature_importance.csv")
    fi.to_csv(fi_path, index=False)
    print(f"Saved feature importances to {fi_path}")

    top_path = os.path.join(args.outdir, "top_features.csv")
    topn.to_csv(top_path, index=False)
    print(f"Saved top-{args.n_top_features} features to {top_path}")

    # Save features schema (names in correct order)
    X_info_path = os.path.join(args.outdir, "features_schema.json")
    with open(X_info_path, "w") as f:
        json_schema = {
            "n_features": int(X_train.shape[1]),
            "feature_names": list(X_train.columns),
            "target": args.target
        }
        json.dump(json_schema, f, indent=2)
    print(f"Saved features schema to {X_info_path}")

    # Also export a flat dataset preview for BI (train split with labels)
    flat_path = os.path.join(args.outdir, "training_dataset_preview.csv")
    preview = X_train.copy()
    preview[args.target] = y_train
    preview.reset_index().to_csv(flat_path, index=False)
    print(f"Saved training dataset preview to {flat_path}")

    # Optional: save model.feature_names_in_ for sanity/debug
    fni_path = os.path.join(args.outdir, "model.feature_names_in_.json")
    with open(fni_path, "w") as f:
        json.dump(list(getattr(rf, "feature_names_in_", [])), f, indent=2)
    print(f"Saved model.feature_names_in_ to {fni_path}")


if __name__ == "__main__":
    warnings.filterwarnings("ignore")
    main()
