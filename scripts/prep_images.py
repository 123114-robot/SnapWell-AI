"""
SnapWell AI - dataset image preprocessing.

Converts phone photos into clean JPGs ready for Roboflow upload:
  - HEIC/HEIF -> JPG (iPhone photos; Roboflow's standard upload does not accept HEIC)
  - Bakes EXIF orientation into the pixels (prevents rotated images / misaligned boxes)
  - Strips all EXIF metadata, including GPS location and device info
  - Optionally resizes down to a maximum long side (faster uploads)

Install:
    conda activate csit998
    pip install pillow pillow-heif tqdm

Usage:
    python scripts/prep_images.py --input SOURCE_DIR --output OUTPUT_DIR

    # keep original resolution (for shelf photos you plan to crop later)
    python scripts/prep_images.py --input SOURCE_DIR --output OUTPUT_DIR --max-side 0
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps
from tqdm import tqdm

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
    HEIF_AVAILABLE = True
except ImportError:
    HEIF_AVAILABLE = False

SUPPORTED_EXTS = {".heic", ".heif", ".jpg", ".jpeg", ".png"}
IGNORED_EXTS = {".mov", ".aae", ".mp4", ".ds_store"}


def collect_files(input_dir: Path) -> tuple[list[Path], int]:
    """Return (files to process, count of explicitly ignored files)."""
    supported: list[Path] = []
    ignored = 0
    for path in sorted(input_dir.rglob("*")):
        if not path.is_file():
            continue
        ext = path.suffix.lower()
        if ext in SUPPORTED_EXTS:
            supported.append(path)
        elif ext in IGNORED_EXTS or path.name.startswith("."):
            ignored += 1
    return supported, ignored


def process_one(
    src: Path, dst: Path, max_side: int, quality: int
) -> None:
    """Convert a single image: orient -> RGB -> resize -> save as EXIF-free JPG."""
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")

        if max_side > 0 and max(im.size) > max_side:
            ratio = max_side / max(im.size)
            new_size = (round(im.width * ratio), round(im.height * ratio))
            im = im.resize(new_size, Image.LANCZOS)

        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst, format="JPEG", quality=quality, optimize=True)


def dir_size_mb(directory: Path) -> float:
    total = sum(p.stat().st_size for p in directory.rglob("*") if p.is_file())
    return total / (1024 * 1024)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert phone photos to clean, EXIF-free JPGs for Roboflow."
    )
    parser.add_argument("--input", required=True, help="Source directory")
    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument(
        "--max-side",
        type=int,
        default=2048,
        help="Max long side in pixels. Use 0 to keep original resolution. Default: 2048",
    )
    parser.add_argument(
        "--quality", type=int, default=92, help="JPEG quality (default: 92)"
    )
    args = parser.parse_args()

    input_dir = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output).expanduser().resolve()

    if not input_dir.is_dir():
        sys.exit(f"ERROR: input directory not found: {input_dir}")
    if input_dir == output_dir:
        sys.exit("ERROR: --input and --output must be different directories.")
    # Nested dirs are unsafe: rglob on input would re-ingest outputs (or vice versa).
    if output_dir.is_relative_to(input_dir):
        sys.exit(
            "ERROR: --output must not be inside --input "
            f"({output_dir} is under {input_dir})."
        )
    if input_dir.is_relative_to(output_dir):
        sys.exit(
            "ERROR: --input must not be inside --output "
            f"({input_dir} is under {output_dir})."
        )

    files, ignored = collect_files(input_dir)
    if not files:
        sys.exit(f"ERROR: no supported images found in {input_dir}")

    heic_files = [f for f in files if f.suffix.lower() in {".heic", ".heif"}]
    if heic_files and not HEIF_AVAILABLE:
        sys.exit(
            f"ERROR: found {len(heic_files)} HEIC/HEIF files but pillow-heif is not "
            "installed.\n       Run: pip install pillow-heif"
        )

    output_dir.mkdir(parents=True, exist_ok=True)

    by_format: Counter[str] = Counter()
    ok = skipped_existing = failed = 0

    for src in tqdm(files, desc="Processing", unit="img"):
        # Keep relative subdirs so nested inputs don't collide on stem.
        dst = (output_dir / src.relative_to(input_dir)).with_suffix(".jpg")
        if dst.exists():
            skipped_existing += 1
            continue
        try:
            process_one(src, dst, args.max_side, args.quality)
            by_format[src.suffix.lower().lstrip(".")] += 1
            ok += 1
        except Exception as exc:
            failed += 1
            tqdm.write(f"  FAILED  {src.name}: {exc}")

    print("\n" + "-" * 46)
    print(f"  Converted            {ok}")
    for fmt, n in sorted(by_format.items()):
        print(f"      from .{fmt:<14} {n}")
    print(f"  Skipped (exists)     {skipped_existing}")
    print(f"  Skipped (.MOV etc.)  {ignored}")
    print(f"  Failed               {failed}")
    print(f"  Output size          {dir_size_mb(output_dir):.1f} MB")
    print(f"  Output directory     {output_dir}")
    print("-" * 46)


if __name__ == "__main__":
    main()
