#!/usr/bin/env python3
"""
Generates Android icon and splash screen assets from assets/Icon.png and assets/splash_screen.png
"""
from PIL import Image, ImageDraw
import os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_SRC   = os.path.join(ROOT, 'assets', 'Icon.png')
SPLASH_SRC = os.path.join(ROOT, 'assets', 'splash_screen.png')
RES = os.path.join(ROOT, 'platforms', 'android', 'app', 'src', 'main', 'res')

BG_COLOR = (26, 16, 64, 255)  # dark purple #1a1040

# --- Icon sizes ---
ICON_SIZES = {
    'mipmap-ldpi':    36,
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192,
}

# Adaptive icon foreground sizes (108dp units per density)
ADAPTIVE_SIZES = {
    'mipmap-ldpi-v26':    81,
    'mipmap-mdpi-v26':    108,
    'mipmap-hdpi-v26':    162,
    'mipmap-xhdpi-v26':   216,
    'mipmap-xxhdpi-v26':  324,
    'mipmap-xxxhdpi-v26': 432,
}

icon = Image.open(ICON_SRC).convert('RGBA')

# --- 1. ic_launcher.png (legacy square icon) ---
print('Generating ic_launcher.png...')
for folder, size in ICON_SIZES.items():
    out_path = os.path.join(RES, folder, 'ic_launcher.png')
    if not os.path.exists(os.path.dirname(out_path)):
        continue
    canvas = Image.new('RGBA', (size, size), BG_COLOR)
    padding = int(size * 0.1)
    icon_size = size - padding * 2
    resized = icon.resize((icon_size, icon_size), Image.LANCZOS)
    canvas.paste(resized, (padding, padding), resized)
    canvas.convert('RGB').save(out_path, 'PNG')
    print(f'  {folder}/ic_launcher.png ({size}x{size})')

# --- 2. ic_launcher_foreground.png (adaptive icon foreground, transparent bg) ---
print('Generating ic_launcher_foreground.png...')
for folder, size in ADAPTIVE_SIZES.items():
    out_path = os.path.join(RES, folder, 'ic_launcher_foreground.png')
    if not os.path.exists(os.path.dirname(out_path)):
        continue
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # icon occupies center 66% (safe zone for adaptive icons)
    icon_size = int(size * 0.66)
    offset = (size - icon_size) // 2
    resized = icon.resize((icon_size, icon_size), Image.LANCZOS)
    canvas.paste(resized, (offset, offset), resized)
    canvas.save(out_path, 'PNG')
    print(f'  {folder}/ic_launcher_foreground.png ({size}x{size})')

# --- 3. ic_launcher_background.png (adaptive icon background, solid color) ---
print('Generating ic_launcher_background.png...')
for folder, size in ADAPTIVE_SIZES.items():
    out_path = os.path.join(RES, folder, 'ic_launcher_background.png')
    if not os.path.exists(os.path.dirname(out_path)):
        continue
    canvas = Image.new('RGB', (size, size), BG_COLOR[:3])
    canvas.save(out_path, 'PNG')
    print(f'  {folder}/ic_launcher_background.png')

# --- 4. Splash screen ---
print('Generating splash screens...')
splash = Image.open(SPLASH_SRC).convert('RGBA')

SPLASH_SIZES = {
    'drawable':        (1080, 1920),
    'drawable-ldpi':   (240,  426),
    'drawable-mdpi':   (320,  569),
    'drawable-hdpi':   (480,  854),
    'drawable-xhdpi':  (720,  1280),
    'drawable-xxhdpi': (960,  1706),
    'drawable-xxxhdpi':(1080, 1920),
}

for folder, (w, h) in SPLASH_SIZES.items():
    out_dir = os.path.join(RES, folder)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'screen.png')
    # fit height: scale to fill height, center horizontally, bg fills gaps
    img = splash.copy()
    src_w, src_h = img.size
    scale = h / src_h
    new_w = int(src_w * scale)
    new_h = h
    img = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new('RGB', (w, h), BG_COLOR[:3])
    x = (w - new_w) // 2
    canvas.paste(img, (x, 0), img.convert('RGBA'))
    canvas.save(out_path, 'PNG')
    print(f'  {folder}/screen.png ({w}x{h})')

# --- 5. Create mipmap-anydpi-v26/ic_launcher.xml for adaptive icon ---
print('Generating adaptive icon XML...')
anydpi_dir = os.path.join(RES, 'mipmap-anydpi-v26')
os.makedirs(anydpi_dir, exist_ok=True)
adaptive_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''
with open(os.path.join(anydpi_dir, 'ic_launcher.xml'), 'w') as f:
    f.write(adaptive_xml)
# Add background color to colors.xml
colors_file = os.path.join(RES, 'values', 'colors.xml')
if os.path.exists(colors_file):
    colors = open(colors_file).read()
    if 'ic_launcher_background' not in colors:
        colors = colors.replace('</resources>', '    <color name="ic_launcher_background">#1a1040</color>\n</resources>')
        open(colors_file, 'w').write(colors)
print('  mipmap-anydpi-v26/ic_launcher.xml created')

# --- 6. Also copy to www/img for reference ---
shutil.copy(ICON_SRC, os.path.join(ROOT, 'www', 'img', 'logo.png'))
print('Copied icon to www/img/logo.png')

print('\nDone!')
