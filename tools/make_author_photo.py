#!/usr/bin/env python3
"""Prepare an author's photo for the fair: a square crop around the face, 400 x 400 WebP.

    python3 tools/make_author_photo.py path/to/photo.jpg author-id [--cx 0.5] [--cy 0.4] [--zoom 1.3]

It writes assets/img/authors/<author-id>.webp. Then set `photo: 'assets/img/authors/<author-id>.webp'`
for that author in FAIR_AUTHOR_EXTRAS (assets/js/books.js). The fair shows it in a gold ring above
the author's hologram, in the author's panel, at the booth and in the event lineup.

--cx / --cy: the centre of the face, as a fraction of the width / height (default: centred, a
little above the middle). --zoom: how much closer than the largest square (1 = the whole short side).
--pad: room to add above the head when the photo stops right at the hair, as a fraction of the
height (the background is extended softly).
Needs Pillow.
"""
import argparse
import pathlib

from PIL import Image, ImageFilter, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'img' / 'authors'


def pad_top(im, n):
    # stretch the top row of the background upwards, then soften it so it reads as background
    w, h = im.size
    strip = im.crop((0, 0, w, 6)).resize((w, n), Image.BILINEAR).filter(ImageFilter.GaussianBlur(12))
    out = Image.new('RGB', (w, h + n))
    out.paste(strip, (0, 0))
    out.paste(im, (0, n))
    blend = out.crop((0, n - 8, w, n + 8)).filter(ImageFilter.GaussianBlur(4))
    out.paste(blend, (0, n - 8))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('author_id')
    ap.add_argument('--cx', type=float, default=0.5)
    ap.add_argument('--cy', type=float, default=None)
    ap.add_argument('--zoom', type=float, default=1.0)
    ap.add_argument('--size', type=int, default=400)
    ap.add_argument('--pad', type=float, default=0.0)
    a = ap.parse_args()

    im = ImageOps.exif_transpose(Image.open(a.src)).convert('RGB')
    if a.pad > 0:
        im = pad_top(im, round(im.size[1] * a.pad))
    w, h = im.size
    side = min(w, h) / max(1.0, a.zoom)
    cy = a.cy if a.cy is not None else (0.42 if w >= h else (side / 2 + 0.02 * h) / h)
    x0 = min(max(0, a.cx * w - side / 2), w - side)
    y0 = min(max(0, cy * h - side / 2), h - side)
    crop = im.crop((round(x0), round(y0), round(x0 + side), round(y0 + side))).resize((a.size, a.size), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / f'{a.author_id}.webp'
    crop.save(dest, 'WEBP', quality=84, method=6)
    print(f'{dest.relative_to(ROOT)}  ({dest.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
