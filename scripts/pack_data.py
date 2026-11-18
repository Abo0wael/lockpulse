#!/usr/bin/env python3
"""pack_data.py - stage collected runs for upload as an artifact, with all CSVs gzipped.

  python3 scripts/pack_data.py --dest dist [--root .]

Copies into <dest>, keeping the repository layout:
  data/raw/meta/*.json                 as is (small, human-readable)
  data/raw/tierP/*.csv                 -> *.csv.gz (byte-identical content, gzip level 6)
  data/processed/tierF/*.csv[.gz]      -> *.csv.gz
  results/collect_*.txt                as is
The raw files under <root> are never modified (raw data is immutable); only
the staged copies are compressed. pandas reads .csv.gz directly
(pd.read_csv("x.csv.gz")), and ml/label.py / scripts/review_sample.py accept
either form. Prints the staged size per part.
"""
import argparse
import gzip
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def gz_copy(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.suffix == ".gz":
        shutil.copyfile(src, dst)
        return
    with open(src, "rb") as fin, open(dst, "wb") as raw_out:
        with gzip.GzipFile(filename="", mode="wb", compresslevel=6, fileobj=raw_out, mtime=0) as gz:
            shutil.copyfileobj(fin, gz, 1 << 20)


def size_of(paths):
    return sum(p.stat().st_size for p in paths)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Stage collected data with gzipped CSVs.")
    ap.add_argument("--root", default=str(ROOT))
    ap.add_argument("--dest", required=True)
    args = ap.parse_args(argv)
    root, dest = Path(args.root), Path(args.dest)

    report = []
    meta = sorted((root / "data/raw/meta").glob("*.json"))
    for m in meta:
        out = dest / "data/raw/meta" / m.name
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(m, out)
    report.append(("meta json", len(meta), size_of(meta), size_of(sorted((dest / "data/raw/meta").glob("*.json")))))

    for label, sub in (("tierP csv", "data/raw/tierP"), ("tierF csv", "data/processed/tierF")):
        srcs = sorted(list((root / sub).glob("*.csv")) + list((root / sub).glob("*.csv.gz")))
        outs = []
        for s in srcs:
            name = s.name if s.name.endswith(".gz") else s.name + ".gz"
            o = dest / sub / name
            gz_copy(s, o)
            outs.append(o)
        report.append((label, len(srcs), size_of(srcs), size_of(outs)))

    summaries = sorted((root / "results").glob("collect_*.txt"))
    for s in summaries:
        out = dest / "results" / s.name
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(s, out)

    print("{:<10} {:>6} {:>12} {:>12}".format("part", "files", "source MB", "staged MB"))
    for label, n, src, out in report:
        print("{:<10} {:>6} {:>12.1f} {:>12.1f}".format(label, n, src / 1e6, out / 1e6))
    total_src = sum(r[2] for r in report)
    total_out = sum(r[3] for r in report)
    print("{:<10} {:>6} {:>12.1f} {:>12.1f}".format("total", sum(r[1] for r in report), total_src / 1e6,
                                                     total_out / 1e6))
    return 0


if __name__ == "__main__":
    sys.exit(main())
