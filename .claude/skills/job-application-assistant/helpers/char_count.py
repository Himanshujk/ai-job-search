#!/usr/bin/env python3
"""
Count rendered characters in LaTeX CV/cover-letter bullets (moderncv banking, 11pt).

Strips LaTeX markup to approximate what a reader sees, then flags whether a
bullet is a safe single line, needs a compile-and-check, or will wrap to
multiple lines.

Calibration note: thresholds below are empirical, derived from bullets in
cv/main_example.tex compiled with lualatex and checked against the rendered
PDF (not measured from font metrics). Confirmed data points:
  - 112 rendered chars -> fits on 1 line
  - 141 rendered chars -> wraps to 2 lines
The 113-140 range is unverified - always compile and read the PDF for
anything landing in ZONE 2. Don't trust this script as a substitute for the
compile-and-inspect loop in 05-cv-templates.md; it only narrows what to check.

Usage:
  python3 char_count.py "bullet text or \\textbf{...} LaTeX"
  python3 char_count.py -f cv_main.tex     # scan every \\item in a file
  echo "bullet text" | python3 char_count.py
"""

import re
import sys
import argparse

SAFE_ONE_LINE = 110   # <= this: confident single line
WRAP_CONFIRMED = 141  # >= this: confirmed wraps to 2 lines
# 111-140: unverified zone, compile and check the PDF


def strip_latex(text):
    text = re.sub(r'\\item\s*(\[\s*\])?\s*', '', text)
    text = re.sub(r'\\href\{[^}]*\}\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\textbf\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\textit\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\emph\{([^}]*)\}', r'\1', text)
    text = text.replace('---', '—').replace('--', '–')
    text = text.replace('\\&', '&')
    text = re.sub(r'\\[a-zA-Z]+\s*', '', text)
    text = text.replace('{', '').replace('}', '')
    text = re.sub(r'  +', ' ', text)
    return text.strip()


def count_bold_chars(text):
    return sum(len(m) for m in re.findall(r'\\textbf\{([^}]*)\}', text))


def classify(n):
    if n <= SAFE_ONE_LINE:
        return 'SAFE 1-LINE'
    if n < WRAP_CONFIRMED:
        return 'UNVERIFIED - compile and check PDF'
    return 'WRAPS (>=2 lines) - check orphan: last line must fill >=70% of width'


def extract_items(text):
    return [l.strip() for l in text.split('\n') if l.strip().startswith('\\item')]


def report(raw):
    rendered = strip_latex(raw)
    n = len(rendered)
    bold = count_bold_chars(raw)
    print(f"  {n:3d} chars | {classify(n)}")
    if bold:
        print(f"  ({bold} bold chars - bold renders slightly wider than plain text)")
    print(f"  Rendered: {rendered}")


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('input', nargs='?', help='Bullet text or a .tex file path')
    p.add_argument('-f', '--file', action='store_true',
                    help='Treat input as a .tex file path and scan every \\item')
    args = p.parse_args()

    if args.file and args.input:
        with open(args.input) as f:
            items = extract_items(f.read())
        if not items:
            print("No \\item lines found.")
            return
        print(f"Found {len(items)} bullets:\n")
        for i, item in enumerate(items, 1):
            print(f"Bullet {i}:")
            report(item)
            print()
    elif args.input:
        report(args.input)
    else:
        for line in sys.stdin:
            line = line.strip()
            if line:
                report(line)
                print()


if __name__ == '__main__':
    main()
