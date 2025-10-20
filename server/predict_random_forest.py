#!/usr/bin/env python3
"""
Load a trained Random Forest and predict UUT PASS/FAIL (or multiclass status) for sessions in the DB.
Also performs extended error pattern mining on predicted FAIL sessions.

Outputs (in --out folder):
  - predictions.csv
  - predictions.json
  - predicted_fail_step_patterns.csv
  - predicted_fail_step_patterns.json
  - predicted_fail_step_cooccurrence.csv
  - predicted_fail_step_by_bucket.csv
  - predicted_fail_bigrams.csv
  - predicted_fail_session_failpos.csv
  - predicted_fail_limit_stats_by_step.csv           [from (3)]
  - predicted_fail_limit_near_counts_by_step.csv     [from (3)]
  - predicted_fail_rates_by_station_step.csv         [from (4)]
  - predicted_fail_rates_by_testspec_step.csv        [from (4)]
  - predicted_fail_rates_by_atesw_step.csv           [from (4)]
  - predicted_fail_pacing_session_metrics.csv        [from (5)]
  - predicted_fail_quality_texture.csv               [from (6)]
  - predicted_fail_step_retry_summary.csv            [from (6)]

Usage:
  python predict_random_forest.py \
      --db ./test_results.db \
      --model ./ml_artifacts/random_forest_pass_binary.joblib \
      --schema ./ml_artifacts/features_schema.json \
      --bigrams ./ml_artifacts/top_fail_bigrams.json \
      --out ./predictions

  # Only score specific global_ids:
  python predict_random_forest.py --db ./test_results.db --model ./ml_artifacts/random_forest_pass_binary.joblib --out ./predictions --ids 101 102 103
"""
import argparse
import itertools
import os
import re
import sqlite3
import json as _json
import numpy as np
import pandas as pd
import joblib


# ---------------------------
# Utilities
# ---------------------------

def sanitize(name: str) -> str:
    return re.sub(r"[^0-9a-zA-Z]+", "_", str(name)).strip("_").lower()

def normalize_result(s: str) -> str:
    """
    Normalize stepResult strings so mining doesn't miss FAILs due to spaces/synonyms.
    """
    s = str(s).strip().upper()
    # Map common synonyms / variants
    if s in {"FAILED", "FAILURE", "ERROR", "ABORT", "NG"}:
        return "FAIL"
    if s in {"INCOMP", "INCOMPLETED"}:
        return "INCOMPLETE"
    return s

def coerce_time_cols(df: pd.DataFrame) -> pd.DataFrame:
    for col in ["testStarted", "testStopped"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", format="%Y/%m/%d %H:%M:%S")
    return df

def collapse_duplicate_columns(df: pd.DataFrame) -> pd.DataFrame:
    """If df has duplicate column labels (e.g., sanitization collisions), collapse them by summing."""
    if getattr(df.columns, "is_unique", True):
        return df
    return df.T.groupby(level=0).sum().T

def load_tables(db_path: str):
    con = sqlite3.connect(db_path)
    gm = pd.read_sql("SELECT * FROM global_metadata", con)
    sd = pd.read_sql("SELECT * FROM step_data", con)
    con.close()
    return gm, sd


# ---------------------------
# Training feature parity (build SAME features as training)
# ---------------------------

def build_fail_sequences(sd: pd.DataFrame) -> pd.DataFrame:
    """Return DataFrame [global_id, fail_sequence: list[str]] ordered by stepNumber."""
    sdf = sd.copy()
    sdf["stepResult"] = sdf["stepResult"].astype(str).str.upper()
    sdf["stepName"] = sdf["stepName"].fillna("UNKNOWN")
    sdf["stepNumber_num"] = pd.to_numeric(sdf.get("stepNumber"), errors="coerce")
    fail_seq = (
        sdf[sdf["stepResult"] == "FAIL"]
          .sort_values(["global_id", "stepNumber_num"])
          .groupby("global_id")["stepName"].apply(list)
          .rename("fail_sequence")
          .reset_index()
    )
    return fail_seq

def pairs_from_sequence(seq):
    return [(seq[i], seq[i+1]) for i in range(len(seq)-1)] if isinstance(seq, list) else []

def build_bigram_features_for_vocab(fail_seq_series: pd.Series, bigram_vocab) -> pd.DataFrame:
    """Binary indicator columns for each (prev,next) in bigram_vocab; index=global_id."""
    if not bigram_vocab:
        return pd.DataFrame(index=fail_seq_series.index)
    rows, ids = [], []
    for gid, seq in fail_seq_series.items():
        ids.append(gid)
        seq_pairs = set(pairs_from_sequence(seq)) if isinstance(seq, list) else set()
        rows.append([int(p in seq_pairs) for p in bigram_vocab])
    cols = [f"pairFAIL__{sanitize(a)}__then__{sanitize(b)}" for (a, b) in bigram_vocab]
    return pd.DataFrame(rows, columns=cols, index=ids).sort_index()

def load_bigram_vocab(path: str):
    """Load top_fail_bigrams.json saved by training. Returns list of (prev, next) tuples."""
    if not path or not os.path.isfile(path):
        return []
    with open(path, "r") as f:
        data = _json.load(f)
    # Support [{"prev": "...", "next": "..."}] or [["a","b"], ...]
    vocab = []
    for item in data:
        if isinstance(item, dict) and "prev" in item and "next" in item:
            vocab.append((item["prev"], item["next"]))
        elif isinstance(item, (list, tuple)) and len(item) == 2:
            vocab.append((item[0], item[1]))
    return vocab

def build_features_for_prediction(gm: pd.DataFrame, sd: pd.DataFrame, bigram_vocab=None) -> pd.DataFrame:
    """
    Rebuild the SAME engineered features as in training:
      - totals & per-result counts
      - stepName×result counts
      - early/mid/late buckets
      - fail first/last/span/clusters
      - any_fail__<step>
      - numeric stats (measureValue)
      - stepTime stats
      - meta time (duration/hour/weekday)
      - one-hot for machineIdentifier, stationName, Testspec, AteSwVersion
      - FAIL bigram indicators using saved bigram_vocab
    """
    gm = gm.copy()
    sd = sd.copy()

    # Meta time
    gm = coerce_time_cols(gm)
    if {"testStarted", "testStopped"}.issubset(gm.columns):
        gm["test_duration_sec"] = (gm["testStopped"] - gm["testStarted"]).dt.total_seconds()
        gm["start_hour"] = gm["testStarted"].dt.hour
        gm["start_weekday"] = gm["testStarted"].dt.weekday
    else:
        gm["test_duration_sec"] = np.nan
        gm["start_hour"] = np.nan
        gm["start_weekday"] = np.nan

    # Step cleaning
    sd["stepResult"] = sd["stepResult"].astype(str).str.upper()
    sd["stepName"] = sd["stepName"].fillna("UNKNOWN")
    sd["stepNumber_num"] = pd.to_numeric(sd.get("stepNumber"), errors="coerce")
    sd["measureValue_num"] = pd.to_numeric(sd.get("measureValue"), errors="coerce")

    # Totals & global result counts
    result_counts = (
        sd.pivot_table(index="global_id", columns="stepResult", values="id", aggfunc="count", fill_value=0)
          .add_prefix("count_")
          .reset_index()
    )
    total_steps = sd.groupby("global_id")["id"].count().rename("total_steps").reset_index()

    # Per stepName × stepResult counts
    step_result_counts = (
        sd.pivot_table(index="global_id", columns=["stepName", "stepResult"], values="id", aggfunc="count", fill_value=0)
          .sort_index(axis=1)
    )
    step_result_counts.columns = [
        f"cnt_{res}__{sanitize(name)}" for (name, res) in step_result_counts.columns
    ]
    step_result_counts = step_result_counts.reset_index()

    # Position buckets (early/mid/late)
    qs = sd.groupby("global_id")["stepNumber_num"].quantile([0.33, 0.66]).unstack()
    qs.columns = ["q33", "q66"]
    sd = sd.merge(qs, on="global_id", how="left")
    sd["pos_bucket"] = np.where(
        sd["stepNumber_num"] <= sd["q33"], "early",
        np.where(sd["stepNumber_num"] <= sd["q66"], "mid", "late")
    )
    bucket_counts = sd.pivot_table(index="global_id", columns=["pos_bucket", "stepResult"], values="id", aggfunc="count", fill_value=0)
    bucket_counts.columns = [f"cnt_{b}_{res}" for (b, res) in bucket_counts.columns]
    bucket_counts = bucket_counts.reset_index()

    # Fail position stats
    fail_rows = sd[sd["stepResult"] == "FAIL"].copy()
    first_fail = fail_rows.groupby("global_id")["stepNumber_num"].min().rename("first_fail_stepnum")
    last_fail  = fail_rows.groupby("global_id")["stepNumber_num"].max().rename("last_fail_stepnum")
    fail_span  = (last_fail - first_fail).rename("fail_step_span")

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

    # Any-fail by stepName
    any_fail = (
        sd.assign(is_fail=(sd["stepResult"] == "FAIL").astype(int))
          .groupby(["global_id", "stepName"])["is_fail"].max()
          .unstack(fill_value=0)
    )
    any_fail.columns = [f"fail_any__{sanitize(c)}" for c in any_fail.columns]
    any_fail = any_fail.reset_index()

    # Numeric stats
    num_stats = sd.groupby("global_id")["measureValue_num"].agg(
        mean_measureValue="mean",
        std_measureValue="std",
        min_measureValue="min",
        max_measureValue="max",
        q25_measureValue=lambda s: s.quantile(0.25),
        q75_measureValue=lambda s: s.quantile(0.75),
        n_numeric=lambda s: s.notna().sum(),
    ).reset_index()

    # Step time
    if "stepTime" in sd.columns:
        sd["stepTime_num"] = pd.to_numeric(sd["stepTime"], errors="coerce")
        time_stats = sd.groupby("global_id")["stepTime_num"].agg(
            mean_stepTime="mean", std_stepTime="std"
        ).reset_index()
    else:
        time_stats = pd.DataFrame({
            "global_id": sd["global_id"].unique(),
            "mean_stepTime": np.nan,
            "std_stepTime": np.nan
        })

    # Merge step-derived features
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

    # Meta join + one-hot categoricals
    gm_ren = gm.rename(columns={"id": "global_id"})
    meta_cols = [
        "global_id", "machineIdentifier", "stationName", "Testspec", "AteSwVersion",
        "test_duration_sec", "start_hour", "start_weekday"
    ]
    meta = gm_ren[[c for c in meta_cols if c in gm_ren.columns]]
    df = meta.merge(features, on="global_id", how="left")

    cat_cols = [c for c in ["machineIdentifier", "stationName", "Testspec", "AteSwVersion"] if c in df.columns]
    df = pd.get_dummies(df, columns=cat_cols, dummy_na=True)

    # Index + dedupe columns
    df = df.fillna(0).set_index("global_id")
    df = collapse_duplicate_columns(df)

    # Add FAIL bigram indicators if vocab provided
    if bigram_vocab is not None:
        fail_seq_df = build_fail_sequences(sd)
        fail_seq_series = fail_seq_df.set_index("global_id")["fail_sequence"].reindex(df.index)
        big_df = build_bigram_features_for_vocab(fail_seq_series, bigram_vocab)
        df = df.join(big_df, how="left").fillna(0)
        df = collapse_duplicate_columns(df)

    return df


# ---------------------------
# Alignment helpers
# ---------------------------

def get_training_feature_list(model, schema_path: str) -> list:
    """Prefer model.feature_names_in_ for exact order; fallback to saved schema."""
    feat_names = getattr(model, "feature_names_in_", None)
    if feat_names is not None and len(feat_names) > 0:
        return list(feat_names)
    with open(schema_path, "r") as f:
        schema = _json.load(f)
    return list(schema["feature_names"])

def align_X_to_training(X_pred: pd.DataFrame, feat_names: list) -> pd.DataFrame:
    """Collapse duplicates then reindex to training feature order (fill missing with 0)."""
    X_pred = collapse_duplicate_columns(X_pred)
    X_aligned = X_pred.reindex(columns=feat_names, fill_value=0.0)
    return X_aligned.astype("float32").copy()


# ---------------------------
# Error pattern mining helpers (1–2)
# ---------------------------

def mine_fail_step_counts(step_data: pd.DataFrame, predictions_df: pd.DataFrame) -> pd.DataFrame:
    merged = step_data.merge(predictions_df[["global_id", "pred_label"]], on="global_id", how="inner")
    pf = merged[merged["pred_label"] == 0].copy()
    pf["stepResult"] = pf["stepResult"].map(normalize_result)
    pf["stepName"] = pf["stepName"].fillna("UNKNOWN")
    actual_failed_steps = pf[pf["stepResult"] == "FAIL"]
    counts = actual_failed_steps["stepName"].value_counts().rename_axis("stepName").reset_index(name="fail_count")
    return counts


def mine_fail_step_cooccurrence(step_data: pd.DataFrame, predictions_df: pd.DataFrame, top_k_steps: int = 50) -> pd.DataFrame:
    counts = mine_fail_step_counts(step_data, predictions_df)
    top_steps = set(counts.head(top_k_steps)["stepName"].tolist())

    merged = step_data.merge(predictions_df[["global_id", "pred_label"]], on="global_id", how="inner")
    pf = merged[merged["pred_label"] == 0].copy()
    pf["stepResult"] = pf["stepResult"].map(normalize_result)
    pf["stepName"] = pf["stepName"].fillna("UNKNOWN")

    group = (
        pf[pf["stepResult"] == "FAIL"]
        .loc[pf["stepName"].isin(top_steps), ["global_id", "stepName"]]
        .drop_duplicates()
        .groupby("global_id")["stepName"].apply(set)
    )

    from collections import Counter
    pair_counter = Counter()
    for steps in group:
        steps = sorted(steps)
        for i, j in itertools.combinations_with_replacement(steps, 2):
            pair_counter[(i, j)] += 1

    rows = [{"step_i": i, "step_j": j, "co_fail_count": c} for (i, j), c in pair_counter.items()]
    co_df = pd.DataFrame(rows).sort_values(["co_fail_count", "step_i", "step_j"], ascending=[False, True, True]).reset_index(drop=True)
    return co_df

def mine_fail_step_by_bucket(step_data: pd.DataFrame, predictions_df: pd.DataFrame) -> pd.DataFrame:
    merged = step_data.merge(predictions_df[["global_id", "pred_label"]], on="global_id", how="inner")
    pf = merged[merged["pred_label"] == 0].copy()
    pf["stepResult"] = pf["stepResult"].map(normalize_result)
    pf["stepName"] = pf["stepName"].fillna("UNKNOWN")
    pf["stepNumber_num"] = pd.to_numeric(pf.get("stepNumber"), errors="coerce")

    qs = pf.groupby("global_id")["stepNumber_num"].quantile([0.33, 0.66]).unstack()
    qs.columns = ["q33", "q66"]
    pf = pf.merge(qs, on="global_id", how="left")

    pf["pos_bucket"] = np.where(
        pf["stepNumber_num"] <= pf["q33"], "early",
        np.where(pf["stepNumber_num"] <= pf["q66"], "mid", "late")
    )

    failed = pf[pf["stepResult"] == "FAIL"]
    counts = (failed.groupby(["pos_bucket", "stepName"])["id"]
              .count()
              .reset_index()
              .rename(columns={"id": "fail_count"}))

    bucket_order = {"early": 0, "mid": 1, "late": 2}
    counts["bucket_ord"] = counts["pos_bucket"].map(bucket_order)
    counts = counts.sort_values(["bucket_ord", "fail_count"], ascending=[True, False]).drop(columns=["bucket_ord"]).reset_index(drop=True)
    return counts

def mine_fail_bigrams(step_data: pd.DataFrame, predictions_df: pd.DataFrame, top_k: int = 100) -> pd.DataFrame:
    merged = step_data.merge(predictions_df[["global_id", "pred_label"]], on="global_id", how="inner")
    pf = merged[merged["pred_label"] == 0].copy()
    pf["stepResult"] = pf["stepResult"].map(normalize_result)
    pf["stepName"] = pf["stepName"].fillna("UNKNOWN")
    pf["stepNumber_num"] = pd.to_numeric(pf.get("stepNumber"), errors="coerce")

    seq = (
        pf[pf["stepResult"] == "FAIL"]
          .sort_values(["global_id", "stepNumber_num"])
          .groupby("global_id")["stepName"].apply(list)
    )

    from collections import Counter
    bg = Counter()
    for lst in seq:
        for i in range(len(lst) - 1):
            bg[(lst[i], lst[i+1])] += 1

    rows = [{"step_prev": a, "step_next": b, "bigram_count": c} for (a, b), c in bg.items()]
    df = pd.DataFrame(rows).sort_values("bigram_count", ascending=False).reset_index(drop=True)
    if top_k is not None and top_k > 0:
        df = df.head(top_k)
    return df

def mine_session_failpos(step_data: pd.DataFrame, predictions_df: pd.DataFrame) -> pd.DataFrame:
    merged = step_data.merge(predictions_df[["global_id", "pred_label"]], on="global_id", how="inner")
    pf = merged[merged["pred_label"] == 0].copy()
    pf["stepResult"] = pf["stepResult"].map(normalize_result)
    pf["stepNumber_num"] = pd.to_numeric(pf.get("stepNumber"), errors="coerce")

    fails = pf[pf["stepResult"] == "FAIL"].copy()

    grp = fails.groupby("global_id")
    first_fail = grp["stepNumber_num"].min().rename("first_fail_stepnum")
    last_fail  = grp["stepNumber_num"].max().rename("last_fail_stepnum")
    span = (last_fail - first_fail).rename("fail_step_span")

    def count_clusters(df):
        df = df.sort_values("stepNumber_num")
        prev = df["stepNumber_num"].shift(1)
        new_cluster = (prev.isna()) | (df["stepNumber_num"] != prev + 1)
        return int(new_cluster.sum())

    clusters = grp.apply(count_clusters).rename("fail_clusters")
    out = pd.concat([first_fail, last_fail, span, clusters], axis=1).reset_index()
    return out


# ---------------------------
# (3) Limit-aware numeric analysis
# ---------------------------

def add_limit_metrics(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["measureValue_num"] = pd.to_numeric(df.get("measureValue"), errors="coerce")
    df["limitLow_num"] = pd.to_numeric(df.get("limitLow"), errors="coerce")
    df["limitHigh_num"] = pd.to_numeric(df.get("limitHigh"), errors="coerce")
    rng = (df["limitHigh_num"] - df["limitLow_num"]).astype(float)
    mid = (df["limitHigh_num"] + df["limitLow_num"]) / 2.0
    rng = rng.replace(0, np.nan)

    df["norm_residual"] = (df["measureValue_num"] - mid) / rng
    df["margin_rel"] = np.minimum(
        df["measureValue_num"] - df["limitLow_num"],
        df["limitHigh_num"] - df["measureValue_num"]
    ) / rng

    df["near_5pct"]  = (df["margin_rel"] <= 0.05).astype(int)
    df["near_10pct"] = (df["margin_rel"] <= 0.10).astype(int)

    df.loc[~np.isfinite(df["norm_residual"]), "norm_residual"] = np.nan
    df.loc[~np.isfinite(df["margin_rel"]), "margin_rel"] = np.nan
    return df

def mine_limit_stats_by_step(step_data: pd.DataFrame, predictions_df: pd.DataFrame):
    merged = step_data.merge(predictions_df[["global_id", "pred_label"]], on="global_id", how="inner")
    pf = merged[merged["pred_label"] == 0].copy()
    pf["stepResult"] = pf["stepResult"].map(normalize_result)
    pf["stepName"] = pf["stepName"].fillna("UNKNOWN")

    pf = add_limit_metrics(pf)
    valid = pf[pf[["measureValue_num", "limitLow_num", "limitHigh_num"]].notna().all(axis=1)].copy()

    stats = valid.groupby("stepName").agg(
        rows=("id", "count"),
        mean_norm_residual=("norm_residual", "mean"),
        median_norm_residual=("norm_residual", "median"),
        mean_margin_rel=("margin_rel", "mean"),
        median_margin_rel=("margin_rel", "median")
    ).reset_index().sort_values("rows", ascending=False)

    near = valid.groupby("stepName").agg(
        near5_count=("near_5pct", "sum"),
        near10_count=("near_10pct", "sum"),
        numeric_rows=("id", "count")
    ).reset_index().sort_values("numeric_rows", ascending=False)

    return stats, near


# ---------------------------
# (4) Context × stepName fail rates
# ---------------------------

def mine_context_step_fail_rates(gm: pd.DataFrame, step_data: pd.DataFrame, predictions_df: pd.DataFrame,
                                 context_col: str, outfile: str):
    if context_col not in gm.columns:
        print(f"[WARN] Column '{context_col}' not found in global_metadata; skipping {outfile}")
        return

    meta = gm.rename(columns={"id": "global_id"})[["global_id", context_col]].copy()

    merged = (step_data.merge(predictions_df[["global_id", "pred_label"]], on="global_id", how="inner")
                        .merge(meta, on="global_id", how="left"))
    pf = merged[merged["pred_label"] == 0].copy()
    pf["stepResult"] = pf["stepResult"].map(normalize_result)
    pf["stepName"] = pf["stepName"].fillna("UNKNOWN")
    pf[context_col] = pf[context_col].astype(str).fillna("UNKNOWN")

    total = pf.groupby([context_col, "stepName"])["id"].count().rename("total").reset_index()
    fail  = pf[pf["stepResult"] == "FAIL"].groupby([context_col, "stepName"])["id"].count().rename("fail").reset_index()
    out = total.merge(fail, on=[context_col, "stepName"], how="left").fillna({"fail": 0})
    out["fail_rate"] = out["fail"] / out["total"]
    out = out.sort_values(["fail_rate", "fail", "total"], ascending=[False, False, False]).reset_index(drop=True)
    out.to_csv(outfile, index=False)
    print(f"Saved: {outfile}")


# ---------------------------
# (5) Duration / pacing metrics
# ---------------------------

def compute_pacing_metrics(gm: pd.DataFrame, step_data: pd.DataFrame, predictions_df: pd.DataFrame) -> pd.DataFrame:
    meta = gm.rename(columns={"id": "global_id"})[["global_id", "testStarted", "testStopped"]].copy()
    meta = coerce_time_cols(meta)
    meta["test_duration_sec"] = (meta["testStopped"] - meta["testStarted"]).dt.total_seconds()

    sd = step_data.copy()
    sd["stepResult"] = sd["stepResult"].map(normalize_result)
    sd["stepNumber_num"] = pd.to_numeric(sd.get("stepNumber"), errors="coerce")
    sd["stepTime_num"] = pd.to_numeric(sd.get("stepTime"), errors="coerce")

    df = sd.merge(predictions_df[["global_id", "pred_label"]], on="global_id", how="inner")
    df = df[df["pred_label"] == 0].copy()

    time_stats = df.groupby("global_id")["stepTime_num"].agg(
        mean_stepTime="mean",
        median_stepTime="median",
        std_stepTime="std",
        max_stepTime="max",
        total_step_time="sum"
    )

    def tfff(g):
        g = g.sort_values("stepNumber_num")
        g["cum_time"] = g["stepTime_num"].fillna(0).cumsum()
        idx = (g["stepResult"] == "FAIL")
        if not idx.any():
            return pd.Series({"time_to_first_fail_sec": np.nan, "steps_to_first_fail": np.nan})
        first_idx = np.argmax(idx.values)
        return pd.Series({
            "time_to_first_fail_sec": float(g.iloc[first_idx]["cum_time"]),
            "steps_to_first_fail": float(g.iloc[first_idx]["stepNumber_num"])
        })

    tfff_df = df.groupby("global_id").apply(tfff)

    idle_cols = [c for c in ["stepTimestamp", "timestamp", "step_time", "time"] if c in df.columns]
    def max_idle(g):
        for c in idle_cols:
            try:
                ts = pd.to_datetime(g[c], errors="coerce")
                if ts.notna().sum() > 1:
                    diffs = ts.sort_values().diff().dt.total_seconds()
                    return float(np.nanmax(diffs.dropna())) if diffs.notna().any() else np.nan
            except Exception:
                pass
        return np.nan

    idle_df = df.groupby("global_id").apply(max_idle).rename("max_idle_gap_sec").to_frame()

    pacing = (time_stats
              .join(tfff_df, how="left")
              .join(idle_df, how="left")
              .reset_index()
              .merge(meta[["global_id", "test_duration_sec"]], on="global_id", how="left"))

    pacing["time_to_first_fail_frac"] = pacing["time_to_first_fail_sec"] / np.where(
        pacing["test_duration_sec"].notna() & (pacing["test_duration_sec"] > 0),
        pacing["test_duration_sec"],
        pacing["total_step_time"].replace(0, np.nan)
    )

    return pacing


# ---------------------------
# (6) Quality / status texture
# ---------------------------

def compute_quality_texture(step_data: pd.DataFrame, predictions_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = step_data.copy()
    df["stepResult"] = df["stepResult"].map(normalize_result)
    df["stepName"] = df["stepName"].fillna("UNKNOWN")
    df["stepNumber_num"] = pd.to_numeric(df.get("stepNumber"), errors="coerce")

    df = df.merge(predictions_df[["global_id", "pred_label"]], on="global_id", how="inner")
    df = df[df["pred_label"] == 0].copy()

    counts = (df.pivot_table(index="global_id", columns="stepResult", values="id", aggfunc="count", fill_value=0)
                .rename_axis(None, axis=1))
    for col in ["PASS", "FAIL", "DONE", "INCOMPLETE"]:
        if col not in counts.columns:
            counts[col] = 0
    counts = counts[["PASS", "FAIL", "DONE", "INCOMPLETE"]]

    counts["total_steps"] = counts.sum(axis=1)
    for col in ["PASS", "FAIL", "DONE", "INCOMPLETE"]:
        counts[f"{col.lower()}_ratio"] = counts[col] / counts["total_steps"].replace(0, np.nan)

    def retry_stats(g):
        by_step = g.sort_values("stepNumber_num").groupby("stepName")["stepResult"].apply(list)
        total_retries = sum(max(len(v) - 1, 0) for v in by_step)
        retry_steps = sum(1 for v in by_step if len(v) > 1)
        result_flips = sum(sum(1 for i in range(1, len(v)) if v[i] != v[i-1]) for v in by_step)
        fail_to_pass_count = sum(1 for v in by_step if ("FAIL" in v and v[-1] == "PASS"))
        return pd.Series({
            "total_retries": float(total_retries),
            "retry_steps": float(retry_steps),
            "result_flips": float(result_flips),
            "fail_to_pass_count": float(fail_to_pass_count)
        })

    retry_df = df.groupby("global_id").apply(retry_stats)

    step_retry = (df.groupby(["stepName", "global_id"])["id"].count().rename("n")
                    .reset_index()
                    .assign(is_retry=lambda x: x["n"] > 1)
                    .groupby("stepName")
                    .agg(
                        sessions=("global_id", "nunique"),
                        retry_sessions=("is_retry", "sum")
                    )
                    .reset_index())
    step_retry["retry_rate"] = step_retry["retry_sessions"] / step_retry["sessions"].replace(0, np.nan)
    step_retry = step_retry.sort_values(["retry_rate", "retry_sessions", "sessions"], ascending=[False, False, False])

    texture = counts.join(retry_df, how="left").reset_index()
    return texture, step_retry


# ---------------------------
# Main CLI
# ---------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", type=str, required=True, help="Path to SQLite DB")
    ap.add_argument("--model", type=str, required=True, help="Path to joblib model")
    ap.add_argument("--out", type=str, default="./predictions", help="Output directory")
    ap.add_argument("--schema", type=str, default="./ml_artifacts/features_schema.json", help="Features schema JSON path")
    ap.add_argument("--bigrams", type=str, default="./ml_artifacts/top_fail_bigrams.json", help="Path to bigram vocab JSON saved during training")
    ap.add_argument("--ids", type=int, nargs="*", help="Optional list of global_ids to score")
    ap.add_argument("--cooc_top_k", type=int, default=50, help="Top failed steps to include in unordered co-occurrence")
    ap.add_argument("--bigram_top_k", type=int, default=100, help="Top ordered bigrams to output for analytics")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    # Load DB tables
    gm, sd = load_tables(args.db)
    if args.ids:
        gm = gm[gm["id"].isin(args.ids)]
        sd = sd[sd["global_id"].isin(args.ids)]

    # Build features (same as training) + bigram indicators using saved vocab
    bigram_vocab = load_bigram_vocab(args.bigrams)
    X = build_features_for_prediction(gm, sd, bigram_vocab=bigram_vocab)

    # Load model and align features to training
    model = joblib.load(args.model)
    feat_names = get_training_feature_list(model, args.schema)
    X = align_X_to_training(X, feat_names)

    # Predict
    pred = model.predict(X)

    out_df = pd.DataFrame({"global_id": X.index, "pred_label": pred})
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)
        classes = list(model.classes_)
        if len(classes) == 2:
            # Binary: probability of positive class (1 or 'PASS')
            if 1 in classes:
                idx_pos = classes.index(1)
            else:
                idx_pos = classes.index("PASS") if "PASS" in classes else 1
            out_df["pred_proba_pass"] = proba[:, idx_pos]
        else:
            proba_df = pd.DataFrame(proba, columns=[f"proba_{c}" for c in classes], index=X.index)
            out_df = out_df.join(proba_df)

    # Save predictions
    csv_path = os.path.join(args.out, "predictions.csv")
    json_path = os.path.join(args.out, "predictions.json")
    out_df.to_csv(csv_path, index=False)
    with open(json_path, "w") as f:
        _json.dump(out_df.to_dict(orient="records"), f, indent=2)
    print(f"Saved: {csv_path}")
    print(f"Saved: {json_path}")

    # ---------------------------
    # Error Pattern Mining (1–6)
    # ---------------------------
    print("Analyzing predicted FAIL sessions...")

    con = sqlite3.connect(args.db)
    step_data = pd.read_sql("SELECT * FROM step_data", con)
    con.close()

    # (1) Most common failed steps
    step_fail_counts = mine_fail_step_counts(step_data, out_df)
    step_fail_counts.to_csv(os.path.join(args.out, "predicted_fail_step_patterns.csv"), index=False)
    step_fail_counts.to_json(os.path.join(args.out, "predicted_fail_step_patterns.json"), orient="records", indent=2)
    print("Saved: predicted_fail_step_patterns.(csv|json)")

    # (2a) Unordered co-occurrence
    co_df = mine_fail_step_cooccurrence(step_data, out_df, top_k_steps=args.cooc_top_k)
    co_df.to_csv(os.path.join(args.out, "predicted_fail_step_cooccurrence.csv"), index=False)
    print("Saved: predicted_fail_step_cooccurrence.csv")

    # (2b) Position buckets
    bucket_df = mine_fail_step_by_bucket(step_data, out_df)
    bucket_df.to_csv(os.path.join(args.out, "predicted_fail_step_by_bucket.csv"), index=False)
    print("Saved: predicted_fail_step_by_bucket.csv")

    # (2c) Ordered bigrams of failed steps (analytics)
    bigram_df = mine_fail_bigrams(step_data, out_df, top_k=args.bigram_top_k)
    bigram_df.to_csv(os.path.join(args.out, "predicted_fail_bigrams.csv"), index=False)
    print("Saved: predicted_fail_bigrams.csv")

    # (2d) Per-session fail position stats
    session_pos_df = mine_session_failpos(step_data, out_df)
    session_pos_df.to_csv(os.path.join(args.out, "predicted_fail_session_failpos.csv"), index=False)
    print("Saved: predicted_fail_session_failpos.csv")

    # (3) Limit-aware numeric analysis
    limit_stats_df, near_counts_df = mine_limit_stats_by_step(step_data, out_df)
    limit_stats_df.to_csv(os.path.join(args.out, "predicted_fail_limit_stats_by_step.csv"), index=False)
    near_counts_df.to_csv(os.path.join(args.out, "predicted_fail_limit_near_counts_by_step.csv"), index=False)
    print("Saved: predicted_fail_limit_stats_by_step.csv / predicted_fail_limit_near_counts_by_step.csv")

    # (4) Context × stepName fail rates
    print("Computing context × stepName fail rates...")
    mine_context_step_fail_rates(gm, step_data, out_df,
                                 context_col="stationName",
                                 outfile=os.path.join(args.out, "predicted_fail_rates_by_station_step.csv"))
    mine_context_step_fail_rates(gm, step_data, out_df,
                                 context_col="Testspec",
                                 outfile=os.path.join(args.out, "predicted_fail_rates_by_testspec_step.csv"))
    mine_context_step_fail_rates(gm, step_data, out_df,
                                 context_col="AteSwVersion",
                                 outfile=os.path.join(args.out, "predicted_fail_rates_by_atesw_step.csv"))

    # (5) Duration / pacing metrics
    pacing_df = compute_pacing_metrics(gm, step_data, out_df)
    pacing_df.to_csv(os.path.join(args.out, "predicted_fail_pacing_session_metrics.csv"), index=False)
    print("Saved: predicted_fail_pacing_session_metrics.csv")

    # (6) Quality / status texture
    texture_df, step_retry_df = compute_quality_texture(step_data, out_df)
    texture_df.to_csv(os.path.join(args.out, "predicted_fail_quality_texture.csv"), index=False)
    step_retry_df.to_csv(os.path.join(args.out, "predicted_fail_step_retry_summary.csv"), index=False)
    print("Saved: predicted_fail_quality_texture.csv / predicted_fail_step_retry_summary.csv")


if __name__ == "__main__":
    main()
