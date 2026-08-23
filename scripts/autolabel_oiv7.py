#!/usr/bin/env python3
"""Pre-label SnapWell images with yolov8n-oiv7, write YOLO-format .txt.

Folder-constrained: only detections whose OIV7 class maps to the folder's
own class are kept. A box of OIV7 'apple' found inside the tomato/ folder
is discarded, because the folder name is ground truth.
"""
import argparse, os
from collections import defaultdict
from pathlib import Path

MAPPING = {
    "apple": [10], "capsicum": [39], "prawn": [459], "banana": [21], "bread": [65], "broccoli": [67],
    "carrot": [92], "cheese": [105], "cucumber": [146], "egg": [178],
    "grape": [226], "lemon": [306], "mango": [323], "milk": [333],
    "mushroom": [347], "orange": [356], "pasta": [372], "potato": [404],
    "pumpkin": [409], "strawberry": [496], "tomato": [540], "zucchini": [600],
}

IMG_EXT = {".jpg", ".jpeg", ".png"}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--src", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--classes", default="classes.txt")
    p.add_argument("--weights", default="yolov8n-oiv7.pt")
    p.add_argument("--conf", type=float, default=0.25)
    p.add_argument("--device", default="mps")
    p.add_argument("--only", default=None)
    args = p.parse_args()

    from ultralytics import YOLO

    names = [l.strip() for l in open(args.classes) if l.strip()]
    our_id = {n: i for i, n in enumerate(names)}
    src, out = Path(args.src), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for fn in ("classes.txt", "_darknet.labels"):
        (out / fn).write_text("\n".join(names) + "\n")

    model = YOLO(args.weights)
    stats = defaultdict(lambda: [0, 0, 0])

    for cname in names:
        if args.only and cname != args.only:
            continue
        d = src / cname
        if not d.is_dir():
            print(f"MISSING FOLDER {cname}")
            continue
        imgs = sorted(f for f in d.iterdir()
                      if f.suffix.lower() in IMG_EXT and not f.name.startswith("._"))
        od = out / cname
        od.mkdir(parents=True, exist_ok=True)
        for f in imgs:
            link = od / f.name
            if not link.exists():
                try:
                    os.link(f, link)
                except OSError:
                    link.write_bytes(f.read_bytes())
        stats[cname][0] = len(imgs)

        ids = MAPPING.get(cname)
        if not ids:
            print(f"{cname:16s} {len(imgs):4d} imgs  no OIV7 mapping, images only")
            continue

        cid = our_id[cname]
        for r in model.predict(source=[str(f) for f in imgs], classes=ids,
                               conf=args.conf, device=args.device,
                               imgsz=640, stream=True, verbose=False):
            b = r.boxes
            if b is None or len(b) == 0:
                continue
            lines = ["%d %.6f %.6f %.6f %.6f" % (cid, *xywh)
                     for xywh in b.xywhn.tolist()]
            (od / (Path(r.path).stem + ".txt")).write_text("\n".join(lines) + "\n")
            stats[cname][1] += 1
            stats[cname][2] += len(lines)
        n, hit, box = stats[cname]
        print(f"{cname:16s} {n:4d} imgs  {hit:4d} prelabeled ({hit*100//max(n,1)}%)  {box:5d} boxes")

    tot = [sum(v[i] for v in stats.values()) for i in range(3)]
    print(f"\nTOTAL {tot[0]} imgs, {tot[1]} prelabeled, {tot[2]} boxes")


if __name__ == "__main__":
    main()
