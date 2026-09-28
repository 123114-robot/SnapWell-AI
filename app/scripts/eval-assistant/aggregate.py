"""Aggregate several evaluation runs and draw the report figures.

    python3 scripts/eval-assistant/aggregate.py run1 run2 run3 --out <figure-dir>

Per run it merges the human labels (<run>-labels.csv plus any
<run>-labels-reused.csv) with the blinded sheet key, and reads the automatic
metrics from score.mjs. It prints a summary as JSON (mean, min and max across
runs) and writes two PDF figures.
"""

import argparse
import csv
import json
import os
import subprocess
from statistics import mean

import matplotlib

matplotlib.use("pdf")
import matplotlib.pyplot as plt  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, "results")
APP = os.path.abspath(os.path.join(HERE, "..", ".."))

# Reference palette, categorical slots 1 and 2 (validated as a pair)
SNAPWELL = "#2a78d6"
DIRECT = "#eb6834"
INK = "#0b0b0b"
INK_2 = "#52514e"
GRID = "#e4e3df"

QUESTIONS = json.load(open(os.path.join(HERE, "questions.json")))
CATEGORY = {q["id"]: q["category"] for q in QUESTIONS["questions"]}
NAMES = QUESTIONS["categories"]


def labels_for(run):
    key = {e["code"]: e for e in json.load(open(os.path.join(RESULTS, f"{run}-sheet-key.json")))}
    labels = {}
    for name in (f"{run}-labels.csv", f"{run}-labels-reused.csv"):
        file = os.path.join(RESULTS, name)
        if os.path.exists(file):
            for row in csv.DictReader(open(file)):
                labels[row["code"]] = row
    merged = []
    for code, entry in key.items():
        if code not in labels:
            raise SystemExit(f"{run}: no label for {code}")
        label = labels[code]
        merged.append({
            "id": entry["id"],
            "category": CATEGORY[entry["id"]],
            "condition": entry["condition"],
            "violation": None if label["violation"] == "" else float(label["violation"]),
            "correct": None if label["correct"] == "" else float(label["correct"]),
        })
    return merged


def automatic(run):
    out = subprocess.run(["node", "scripts/eval-assistant/score.mjs", run], cwd=APP,
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def spread(values):
    return {"mean": round(mean(values), 3), "min": round(min(values), 3), "max": round(max(values), 3)}


def summarise(runs):
    per_run = {run: labels_for(run) for run in runs}
    autos = {run: automatic(run) for run in runs}
    table = {}
    for category in sorted(NAMES):
        table[category] = {}
        for condition in ("direct", "raw", "shown"):
            viol, corr = [], []
            for run in runs:
                items = [i for i in per_run[run] if i["category"] == category and i["condition"] == condition]
                v = [i["violation"] for i in items if i["violation"] is not None]
                c = [i["correct"] for i in items if i["correct"] is not None]
                if v:
                    viol.append(sum(v) / len(items))
                if c:
                    corr.append(sum(c) / len(c))
            table[category][condition] = {
                "n": len([i for i in per_run[runs[0]] if i["category"] == category and i["condition"] == condition]),
                "violation": spread(viol) if viol else None,
                "correct": spread(corr) if corr else None,
            }

    overall = {}
    for condition in ("direct", "raw", "shown"):
        viol_rates, corr_rates = [], []
        for run in runs:
            items = [i for i in per_run[run] if i["condition"] == condition]
            v = [i for i in items if i["violation"] is not None]
            c = [i["correct"] for i in items if i["correct"] is not None]
            viol_rates.append(sum(i["violation"] for i in v) / len(v))
            corr_rates.append(mean(c))
        overall[condition] = {"violation_rate": spread(viol_rates), "correct": spread(corr_rates)}

    auto = {
        "figures": {c: {k: spread([autos[r]["figures"][c][k] for r in runs])
                        for k in ("figures", "unsupportedFigures")} for c in ("direct", "raw", "shown")},
        "nutrition_answered": {
            "shown": spread([sum(d["shownSupported"] for d in autos[r]["nutritionDelivery"]) for r in runs]),
            "direct": spread([sum(d["directSupported"] for d in autos[r]["nutritionDelivery"]) for r in runs]),
        },
        "latency_median_ms": {c: spread([autos[r]["latencyMs"][c]["median"] for r in runs]) for c in ("grounded", "direct")},
        "latency_p90_ms": {c: spread([autos[r]["latencyMs"][c]["p90"] for r in runs]) for c in ("grounded", "direct")},
        "requests": {c: spread([autos[r]["requests"][c] for r in runs]) for c in ("grounded", "direct")},
        "tool_calls_per_turn": spread([autos[r]["tools"]["meanCallsPerTurn"] for r in runs]),
        "turns_with_tool": spread([autos[r]["tools"]["turnsWithTool"] / autos[r]["tools"]["modelTurns"] for r in runs]),
        "blocked": {r: autos[r]["verification"]["blocked"] for r in runs},
        "answered_by_app": spread([autos[r]["verification"]["answeredByApp"] for r in runs]),
        "redacted_figures": spread([autos[r]["verification"]["redactedFigures"] for r in runs]),
        "failures": {r: autos[r]["failures"] for r in runs},
        "tools_by_name": {r: autos[r]["tools"]["byName"] for r in runs},
    }
    return {"runs": runs, "by_category": table, "overall": overall, "automatic": auto}


def style(ax):
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(GRID)
    ax.tick_params(colors=INK_2, labelsize=9)
    ax.xaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def paired_bars(ax, labels, direct, snap, value_fmt, xlabel):
    """Horizontal paired bars with min-max whiskers and a value label on each bar."""
    y = range(len(labels))
    h = 0.36
    for offset, series, colour, name in ((-h / 2 - 0.02, direct, DIRECT, "Direct Gemini"),
                                         (h / 2 + 0.02, snap, SNAPWELL, "SnapWell assistant")):
        means = [s["mean"] for s in series]
        lo = [s["mean"] - s["min"] for s in series]
        hi = [s["max"] - s["mean"] for s in series]
        ax.barh([i + offset for i in y], means, height=h, color=colour, label=name,
                xerr=[lo, hi], error_kw={"ecolor": INK_2, "elinewidth": 0.8, "capsize": 2})
        for i, s in zip(y, series):
            ax.text(s["max"] + 0.02, i + offset, value_fmt(s["mean"]), va="center", fontsize=8, color=INK)
    ax.set_yticks(list(y))
    ax.set_yticklabels(labels, color=INK, fontsize=9)
    ax.invert_yaxis()
    ax.set_xlim(0, 1.18)
    ax.set_xlabel(xlabel, color=INK_2, fontsize=9)
    style(ax)


def draw(summary, out_dir):
    pct = lambda v: f"{v * 100:.0f}%"  # noqa: E731
    table = summary["by_category"]

    fig, (left, right) = plt.subplots(2, 1, figsize=(6.4, 6.6), gridspec_kw={"hspace": 0.55})
    unsafe = ["F", "G", "E", "H", "D"]
    paired_bars(left, [f"{c}: {NAMES[c]}" for c in unsafe],
                [table[c]["direct"]["violation"] for c in unsafe],
                [table[c]["shown"]["violation"] for c in unsafe],
                pct, "Answers with a violation (mean of runs)")
    left.set_xticks([0, 0.25, 0.5, 0.75, 1])
    left.set_xticklabels(["0%", "25%", "50%", "75%", "100%"])
    left.set_title("Unsafe or false answers", color=INK, fontsize=10, loc="left")

    useful = ["A", "B", "C", "D", "G"]
    paired_bars(right, [f"{c}: {NAMES[c]}" for c in useful],
                [table[c]["direct"]["correct"] for c in useful],
                [table[c]["shown"]["correct"] for c in useful],
                lambda v: f"{v:.2f}", "Correctness score, 0 to 1 (mean of runs)")
    right.set_title("Correct, grounded answers", color=INK, fontsize=10, loc="left")
    handles, names = right.get_legend_handles_labels()
    fig.legend(handles, names, loc="upper center", ncol=2, frameon=False, fontsize=9, bbox_to_anchor=(0.55, 0.99))
    fig.savefig(os.path.join(out_dir, "assistant_vs_direct.pdf"), bbox_inches="tight")
    plt.close(fig)


def pooled_stress(runs):
    """guard-stress results summed over the runs' base replies."""
    pooled = {}
    for run in runs:
        for entry in json.load(open(os.path.join(RESULTS, f"{run}-guard-stress.json"))):
            cell = pooled.setdefault(entry["type"], {"hits": 0, "cases": 0})
            cell["hits"] += entry["hits"]
            cell["cases"] += entry["cases"]
    for cell in pooled.values():
        cell["rate"] = cell["hits"] / cell["cases"]
    return pooled


def draw_stress(rows, out_dir):
    items = [
        ("Fabricated nutrition figure", "figure_fabricated@clean_base"),
        ("Real figure, wrong nutrient", "figure_misattributed@clean_base"),
        ("Real figure, no tool call", "figure_without_tool_call@clean_base"),
        ("Invented recipe ID", "recipe_invented@clean_base"),
        ("SnapWell recipe not on the list", "recipe_off_list@clean_base"),
        ("Excluded ingredient, listed name", "allergen_listed@clean_base"),
        ("Health advice with a listed term", "health_keyword@clean_base"),
        ("Excluded ingredient, unlisted name", "allergen_unlisted@clean_base"),
        ("Health advice, paraphrased", "health_paraphrase@clean_base"),
    ]
    fig, ax = plt.subplots(figsize=(6.4, 3.3))
    y = range(len(items))
    rates = [rows[k]["rate"] for _, k in items]
    ax.barh(list(y), rates, height=0.6, color=SNAPWELL)
    for i, (label, k) in enumerate(items):
        r = rows[k]
        ax.text(max(r["rate"], 0) + 0.02, i, f"{r['hits']}/{r['cases']}", va="center", fontsize=8, color=INK)
    ax.set_yticks(list(y))
    ax.set_yticklabels([label for label, _ in items], color=INK, fontsize=9)
    ax.invert_yaxis()
    ax.set_xlim(0, 1.2)
    ax.set_xticks([0, 0.25, 0.5, 0.75, 1])
    ax.set_xticklabels(["0%", "25%", "50%", "75%", "100%"])
    ax.set_xlabel("Injected violations stopped before display", color=INK_2, fontsize=9)
    style(ax)
    fig.savefig(os.path.join(out_dir, "assistant_guard_stress.pdf"), bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("runs", nargs="+")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    summary = summarise(args.runs)
    summary["stress"] = pooled_stress(args.runs)
    draw(summary, args.out)
    draw_stress(summary["stress"], args.out)
    print(json.dumps(summary, indent=1))
