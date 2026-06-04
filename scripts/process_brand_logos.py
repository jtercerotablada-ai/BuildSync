#!/usr/bin/env python
"""Generate the full TT brand logo asset set from source square + horizontal art.

Usage: python process_brand_logos.py <img1> <img2> [...]
Auto-classifies each input as 'square' (aspect ~1) or 'horizontal' (wide), then
writes every variant the live site references into ../public/ttc/img/:

  logo-square.png        dark mark, transparent  (auth + onboarding, light bg)
  logo-white.png         white+gold mark         (public header + footer, dark bg)
  logo-icon-dark.svg     dark mark               (SaaS app header, light bg)
  logo-icon.svg          white+gold mark         (mobile public header, dark bg)
  logo-icon-favicon.svg  white mark on black tile (browser tab)
  logo-horizontal*.png / logo-white-wide.png  (lockup variants, for completeness)
"""
import sys, os, io, base64
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'public', 'ttc', 'img'))


def load_rgba(path):
    return np.array(Image.open(path).convert('RGBA'))


def to_image(arr):
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


def make_transparent(arr):
    """Knock out a light/near-white background with anti-aliased alpha.

    Background colour is sampled from the four corners. Alpha is the max of:
      - a luminance term  -> dark (black) ink fades in smoothly vs the light bg
      - a chroma term      -> gold ink stays fully opaque even where it's bright
    This avoids the grey/white halo a hard threshold leaves around the mark
    (which would otherwise show as a white box on the dark header/footer).
    """
    arr = arr.copy()
    r = arr[:, :, 0].astype(np.float32); g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    corners = np.stack([arr[0, 0, :3], arr[0, -1, :3],
                        arr[-1, 0, :3], arr[-1, -1, :3]]).astype(np.float32)
    bg = np.median(corners, axis=0)
    bg_lum = float(0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2])
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    neutral_a = np.clip((bg_lum - lum - 5.0) / max(bg_lum, 1.0), 0, 1)
    chroma_a = np.clip((sat - 12.0) / 48.0, 0, 1)
    alpha = np.maximum(neutral_a, chroma_a) * 255.0
    arr[:, :, 3] = np.minimum(arr[:, :, 3], alpha).astype(np.uint8)
    return arr


def autocrop(arr, pad_frac=0.04, athr=8):
    a = arr[:, :, 3]
    ys, xs = np.where(a > athr)
    if len(xs) == 0:
        return arr
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    cropped = arr[y0:y1, x0:x1]
    h, w = cropped.shape[:2]
    pad = int(round(max(h, w) * pad_frac))
    if pad <= 0:
        return cropped
    canvas = np.zeros((h + 2 * pad, w + 2 * pad, 4), dtype=arr.dtype)
    canvas[pad:pad + h, pad:pad + w] = cropped
    return canvas


def fit_square(arr, size, pad_frac=0.08):
    img = to_image(arr)
    inner = int(round(size * (1 - 2 * pad_frac)))
    scale = min(inner / img.width, inner / img.height)
    nw, nh = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((size - nw) // 2, (size - nh) // 2))
    return np.array(canvas)


def fit_width(arr, target_w, pad_frac=0.03):
    img = to_image(arr)
    inner_w = int(round(target_w * (1 - 2 * pad_frac)))
    scale = inner_w / img.width
    nh = max(1, round(img.height * scale))
    img = img.resize((inner_w, nh), Image.LANCZOS)
    pad = int(round(target_w * pad_frac))
    canvas = Image.new('RGBA', (target_w, nh + 2 * pad), (0, 0, 0, 0))
    canvas.alpha_composite(img, (pad, pad))
    return np.array(canvas)


def to_white(arr, sat_thr=30):
    """Recolor neutral/black ink -> white; keep warm gold pixels. Alpha preserved."""
    arr = arr.copy()
    r = arr[:, :, 0].astype(np.int16); g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16); a = arr[:, :, 3]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    warm = (r > b + 18) & (sat > sat_thr)        # gold gradient
    ink = (a > 0) & (~warm)                       # black / neutral -> white
    arr[ink, 0] = 255; arr[ink, 1] = 255; arr[ink, 2] = 255
    return arr


def save(arr, name):
    to_image(arr).save(os.path.join(OUT, name), 'PNG', optimize=True)


def alpha_cov(arr):
    return float((arr[:, :, 3] > 8).mean() * 100)


def embed_b64(arr, size=256):
    img = to_image(arr)
    img.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


def write_svg(name, body):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(body)


def classify(paths):
    square = horiz = None
    for p in paths:
        im = Image.open(p)
        ar = im.width / im.height
        if 0.78 <= ar <= 1.3 and square is None:
            square = p
        elif ar > 1.4 and horiz is None:
            horiz = p
    # fallbacks if only one matched a bucket
    for p in paths:
        if p in (square, horiz):
            continue
        ar = Image.open(p).width / Image.open(p).height
        if abs(ar - 1) < 0.35 and square is None:
            square = p
        elif horiz is None:
            horiz = p
    return square, horiz


def main():
    paths = [p for p in sys.argv[1:] if os.path.isfile(p)]
    if not paths:
        print('ERROR: no input files'); sys.exit(1)
    square_src, horiz_src = classify(paths)
    print('square_src =', square_src)
    print('horiz_src  =', horiz_src)
    print('OUT        =', OUT)
    out = []

    if square_src:
        s = autocrop(make_transparent(load_rgba(square_src)), pad_frac=0.03)
        sq = fit_square(s, 1254, pad_frac=0.08)
        save(sq, 'logo-square.png'); out.append(('logo-square.png', sq.shape, alpha_cov(sq)))
        sw = to_white(sq)
        save(sw, 'logo-white.png'); out.append(('logo-white.png', sw.shape, alpha_cov(sw)))

        mark_dark = fit_square(s, 256, pad_frac=0.05)
        mark_white = to_white(mark_dark)
        bd, bw = embed_b64(mark_dark), embed_b64(mark_white)
        write_svg('logo-icon-dark.svg',
                  f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                  f'<image x="0" y="0" width="64" height="64" href="data:image/png;base64,{bd}"/></svg>')
        write_svg('logo-icon.svg',
                  f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                  f'<image x="0" y="0" width="64" height="64" href="data:image/png;base64,{bw}"/></svg>')
        write_svg('logo-icon-favicon.svg',
                  f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                  f'<rect width="64" height="64" rx="12" fill="#0a0a0a"/>'
                  f'<image x="6" y="6" width="52" height="52" href="data:image/png;base64,{bw}"/></svg>')
        out.append(('logo-icon-dark.svg / logo-icon.svg / logo-icon-favicon.svg', 'svg', 0))

    if horiz_src:
        h = autocrop(make_transparent(load_rgba(horiz_src)), pad_frac=0.02)
        hz = fit_width(h, 2172, pad_frac=0.03)
        save(hz, 'logo-horizontal-wide.png'); out.append(('logo-horizontal-wide.png', hz.shape, alpha_cov(hz)))
        save(hz, 'logo-horizontal.png'); out.append(('logo-horizontal.png', hz.shape, alpha_cov(hz)))
        hw = to_white(hz)
        save(hw, 'logo-white-wide.png'); out.append(('logo-white-wide.png', hw.shape, alpha_cov(hw)))

    print('\nOUTPUTS:')
    for n, sh, c in out:
        print(f'  {n}  {sh}  alpha~{c:.0f}%')
    print('Done.')


if __name__ == '__main__':
    main()
