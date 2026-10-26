"""Prepare a book cover for the fair.

Usage:  python3 tools/make_covers.py path/to/cover.jpg my-book-slug

Writes assets/img/covers/<slug>-480.webp, -800.webp, -full.webp and -glow.webp
(plus a copy of the original in assets/img/originals). Then add the book to assets/js/books.js
with the same slug and the cover's width/height.
"""
import os
import shutil
import sys

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(src, slug):
    out = os.path.join(ROOT, 'assets', 'img', 'covers')
    im = Image.open(src).convert('RGB')
    w, h = im.size
    for tw in (480, 800, w):
        r = im if tw == w else im.resize((tw, round(h * tw / w)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=0.6, percent=40, threshold=2))
        r.save(os.path.join(out, f"{slug}-{'full' if tw == w else tw}.webp"), 'WEBP', quality=90 if tw == w else 86, method=6)
    im.resize((40, round(40 * h / w)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(3)).save(os.path.join(out, f'{slug}-glow.webp'), 'WEBP', quality=70)
    shutil.copyfile(src, os.path.join(ROOT, 'assets', 'img', 'originals', slug + os.path.splitext(src)[1]))
    print(f'{slug}: {w}x{h}  ->  cover: {{ w: {w}, h: {h} }}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
