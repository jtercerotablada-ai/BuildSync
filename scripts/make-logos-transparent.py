"""Convert white/cream background in logo PNGs to transparent alpha channel."""
from PIL import Image
import os

LOGO_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'ttc', 'img')
FILES = ['logo-horizontal-wide.png', 'logo-horizontal.png', 'logo-square.png', 'logo-stacked.png']

# Background threshold: a pixel is considered "background" (made transparent)
# if all RGB channels are above this value AND have low saturation.
WHITE_THRESHOLD = 235  # 0-255; pixels above this are likely the cream/white background
SATURATION_TOLERANCE = 20  # max difference between R, G, B channels for a pixel to be considered "grey/white"

def to_transparent(src_path: str, dst_path: str) -> tuple[int, int, int]:
    img = Image.open(src_path).convert('RGBA')
    data = list(img.getdata())
    transparent_count = 0
    new_data = []
    for r, g, b, a in data:
        # Detect near-white/near-grey background
        rgb_max = max(r, g, b)
        rgb_min = min(r, g, b)
        is_bright = rgb_min >= WHITE_THRESHOLD
        is_grey = (rgb_max - rgb_min) <= SATURATION_TOLERANCE
        if is_bright and is_grey:
            new_data.append((r, g, b, 0))
            transparent_count += 1
        else:
            new_data.append((r, g, b, a))
    img.putdata(new_data)
    img.save(dst_path, 'PNG', optimize=True)
    return transparent_count, len(data), os.path.getsize(dst_path)

for fname in FILES:
    src = os.path.join(LOGO_DIR, fname)
    if not os.path.exists(src):
        print(f'SKIP {fname} (not found)')
        continue
    transparent, total, size = to_transparent(src, src)
    pct = 100.0 * transparent / total
    print(f'{fname}: {transparent}/{total} pixels ({pct:.1f}%) -> transparent, file size {size/1024:.0f} KB')

print('Done.')
