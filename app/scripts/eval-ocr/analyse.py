"""Summarise an OCR evaluation run and draw the report figure.

    python3 scripts/eval-ocr/analyse.py <photo-dir> --out <figure-dir>

Reads <photo-dir>/ocr-eval-results.json (from index.html) and
<photo-dir>/annotations-ocr.csv (one row per packaged-channel photo: whether
an index keyword is printed legibly, why not, and the text orientation).
"""

import argparse
import csv
import json
import os
from collections import Counter
from statistics import median

import matplotlib

matplotlib.use("pdf")
import matplotlib.pyplot as plt  # noqa: E402

CONFIGS = ("pass1", "twoPass", "fullImage")

# Reference palette: slot 1 for success, slot 2 for recognition failures,
# neutral grey for cases no recogniser could fix
BLUE, ORANGE, GREY = "#2a78d6", "#eb6834", "#a3a29d"
INK, INK_2, GRID = "#0b0b0b", "#52514e", "#e4e3df"


def labels(record, config):
    return [m["label"] for m in record[config]["matches"]]


def shown(record, config):
    return record["expected"] in labels(record, config)


def top1(record, config):
    return labels(record, config)[:1] == [record["expected"]]


def p90(values):
    ordered = sorted(values)
    return ordered[int(0.9 * len(ordered))]


def summarise(photo_dir):
    run = json.load(open(os.path.join(photo_dir, "ocr-eval-results.json")))
    results = {r["file"]: r for r in run["results"]}
    notes = list(csv.DictReader(open(os.path.join(photo_dir, "annotations-ocr.csv"))))
    packaged = [results[n["file"]] for n in notes]

    def table(group):
        return {c: {"n": len(group), "top1": sum(top1(r, c) for r in group),
                    "shown": sum(shown(r, c) for r in group)} for c in CONFIGS}

    printed = [results[n["file"]] for n in notes if n["keyword_printed"] == "yes"]
    upright = [results[n["file"]] for n in notes
               if n["keyword_printed"] == "yes" and n["orientation"] == "upright"]
    turned = [results[n["file"]] for n in notes
              if n["keyword_printed"] == "yes" and n["orientation"] != "upright"]

    # Cylindrical, colour-printed cans against bags, boxes, jars and tubs,
    # among photos whose keyword is printed upright
    cans = {"canned tomatoes", "canned tuna", "coconut milk"}
    upright_notes = [n for n in notes if n["keyword_printed"] == "yes" and n["orientation"] == "upright"]
    by_form = {}
    for form, keep in (("cans", True), ("other", False)):
        group = [results[n["file"]] for n in upright_notes if (n["file"].split("/")[0] in cans) == keep]
        by_form[form] = {"n": len(group), "identified": sum(shown(r, "twoPass") for r in group)}

    outcome = Counter()
    for n in notes:
        r = results[n["file"]]
        if shown(r, "twoPass"):
            outcome["identified"] += 1
        elif n["keyword_printed"] == "yes":
            outcome["rotated" if n["orientation"] != "upright" else "printed_not_read"] += 1
        else:
            outcome[n["reason_if_not"]] += 1

    with_suggestion = [r for r in packaged if labels(r, "twoPass")]
    early = [r for r in packaged if not r["twoPass"]["usedRegionPass"]]
    detection = [r for r in run["results"] if r["channel"] == "vision"]
    barcodes = run["results"]
    accepted = [r for r in barcodes if r["barcode"]["accepted"]]

    def agreeing(r):
        return sum(1 for x in r["barcode"]["readings"] if x and x["valid"] == r["barcode"]["accepted"])

    return {
        "photos": len(run["results"]),
        "packaged": len(packaged),
        "cold_start_ms": round(run["coldStartMs"]),
        "user_agent": run["userAgent"],
        "all_packaged": table(packaged),
        "keyword_printed": table(printed),
        "upright": table(upright),
        "turned": table(turned),
        "upright_any_config": sum(any(shown(r, c) for c in CONFIGS) for r in upright),
        "outcome": dict(outcome),
        "upright_by_package_form": by_form,
        "suggestions": {
            "photos_with_any": len(with_suggestion),
            "top1_correct": sum(top1(r, "twoPass") for r in with_suggestion),
            "photos_with_a_wrong_one": sum(any(l != r["expected"] for l in labels(r, "twoPass"))
                                           for r in with_suggestion),
        },
        "early_exit": {"photos": len(early), "top1_correct": sum(top1(r, "twoPass") for r in early)},
        "latency_ms": {c: {"median": round(median(r[c]["ms"] for r in packaged)),
                           "p90": round(p90([r[c]["ms"] for r in packaged]))} for c in CONFIGS},
        "detection_packaging": table(detection),
        "barcode": {
            "decoded_any": sum(any(x for x in r["barcode"]["readings"]) for r in barcodes),
            "accepted": len(accepted),
            "accepted_two_or_more_agree": sum(agreeing(r) >= 2 for r in accepted),
            "accepted_single_reading": sum(agreeing(r) == 1 for r in accepted),
            "rejected_conflicting": sum(r["barcode"]["conflicting"] for r in barcodes),
            "invalid_checksum_readings": sum(1 for r in barcodes for x in r["barcode"]["readings"]
                                             if x and not x["valid"]),
            "distinct_codes": len({r["barcode"]["accepted"] for r in accepted}),
            "median_ms": round(median(r["barcode"]["ms"] for r in barcodes)),
        },
    }


def draw(summary, out_dir):
    o = summary["outcome"]
    rows = [
        ("Identified", o.get("identified", 0), BLUE),
        ("Keyword printed upright, not read", o.get("printed_not_read", 0), ORANGE),
        ("Keyword printed, text rotated", o.get("rotated", 0), ORANGE),
        ("Product name not in the keyword index", o.get("vocabulary", 0), GREY),
        ("Product name outside the frame", o.get("not_visible", 0), GREY),
        ("Excluded by design (sour cream)", o.get("excluded_by_design", 0), GREY),
    ]
    fig, ax = plt.subplots(figsize=(6.4, 2.7))
    y = range(len(rows))
    ax.barh(list(y), [r[1] for r in rows], height=0.62, color=[r[2] for r in rows])
    for i, (_, count, _) in enumerate(rows):
        ax.text(count + 0.4, i, str(count), va="center", fontsize=9, color=INK)
    ax.set_yticks(list(y))
    ax.set_yticklabels([r[0] for r in rows], fontsize=9, color=INK)
    ax.invert_yaxis()
    ax.set_xlim(0, max(r[1] for r in rows) + 4)
    ax.set_xlabel(f"Packaged-channel photos (n = {summary['packaged']})", fontsize=9, color=INK_2)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(GRID)
    ax.tick_params(colors=INK_2, labelsize=9)
    ax.xaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    fig.savefig(os.path.join(out_dir, "ocr_outcomes.pdf"), bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("photo_dir")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = summarise(args.photo_dir)
    draw(result, args.out)
    print(json.dumps(result, indent=1))
