#!/usr/bin/env python3
"""
Generates Android icon and splash screen assets from assets/Icon.png and assets/splash_screen.png.

Output layout (Cordova-standard per docs.cordova.io/en/11.x):
  res/android/ldpi.png ... xxxhdpi.png         <- config.xml <icon> references
  res/screen/android/ldpi.png ... xxxhdpi.png  <- config.xml <splash> references

Splash screens are generated from assets/splash_screen.png (cover mode — no bars).
Adaptive icon files are written directly to platforms/android/... (not covered by
standard config.xml <icon> tags — Cordova does not handle ic_launcher_foreground etc.)
"""
from PIL import Image
import os, shutil

ROOT       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_SRC   = os.path.join(ROOT, 'assets', 'Icon.png')
SPLASH_SRC = os.path.join(ROOT, 'assets', 'splash_screen.png')

# Project-level res/ — referenced by config.xml, Cordova copies to platforms/ on prepare
RES_ICONS   = os.path.join(ROOT, 'res', 'android')
RES_SCREENS = os.path.join(ROOT, 'res', 'screen', 'android')

# platforms/ path — for adaptive icon files not covered by config.xml <icon> tags
PLATFORM_RES = os.path.join(ROOT, 'platforms', 'android', 'app', 'src', 'main', 'res')

BG_COLOR = (26, 16, 64, 255)  # dark purple #1a1040

# ─── Icon sizes (config.xml density → px) ────────────────────────────────────
ICON_DENSITIES = {
    'ldpi':    36,
    'mdpi':    48,
    'hdpi':    72,
    'xhdpi':   96,
    'xxhdpi':  144,
    'xxxhdpi': 192,
}

# Adaptive icon foreground sizes (108dp canvas per density)
ADAPTIVE_DENSITIES = {
    'ldpi':    81,
    'mdpi':    108,
    'hdpi':    162,
    'xhdpi':   216,
    'xxhdpi':  324,
    'xxxhdpi': 432,
}

# Mipmap folder names for adaptive icons in platforms/
MIPMAP_V26 = {
    'ldpi':    'mipmap-ldpi-v26',
    'mdpi':    'mipmap-mdpi-v26',
    'hdpi':    'mipmap-hdpi-v26',
    'xhdpi':   'mipmap-xhdpi-v26',
    'xxhdpi':  'mipmap-xxhdpi-v26',
    'xxxhdpi': 'mipmap-xxxhdpi-v26',
}

# Splash sizes per density
SPLASH_SIZES = {
    'ldpi':    (240,  426),
    'mdpi':    (320,  569),
    'hdpi':    (480,  854),
    'xhdpi':   (720,  1280),
    'xxhdpi':  (960,  1706),
    'xxxhdpi': (1080, 1920),
}

os.makedirs(RES_ICONS,   exist_ok=True)
os.makedirs(RES_SCREENS, exist_ok=True)

icon   = Image.open(ICON_SRC).convert('RGBA')
if os.path.exists(SPLASH_SRC):
    splash = Image.open(SPLASH_SRC).convert('RGBA')
else:
    splash = None
    print(f'WARNING: {SPLASH_SRC} not found — splash will be generated from icon only')

# ─── 1. Icons → res/android/<density>.png ────────────────────────────────────
print('Generating icons → res/android/')
for density, size in ICON_DENSITIES.items():
    out_path = os.path.join(RES_ICONS, f'{density}.png')
    canvas   = Image.new('RGBA', (size, size), BG_COLOR)
    padding  = int(size * 0.1)
    icon_sz  = size - padding * 2
    canvas.paste(icon.resize((icon_sz, icon_sz), Image.LANCZOS), (padding, padding), icon.resize((icon_sz, icon_sz), Image.LANCZOS))
    canvas.convert('RGB').save(out_path, 'PNG')
    print(f'  res/android/{density}.png  ({size}x{size})')

# ─── 2. Splash screens → res/screen/android/<density>.png ───────────────────
# If assets/splash_screen.png exists: cover mode (scale to fill, crop excess, no bars).
# Fallback: dark purple background + centered icon.
print('Generating splash screens → res/screen/android/')
for density, (w, h) in SPLASH_SIZES.items():
    out_path = os.path.join(RES_SCREENS, f'{density}.png')
    if splash is not None:
        src_w, src_h = splash.size
        scale  = max(w / src_w, h / src_h)
        new_w  = int(src_w * scale)
        new_h  = int(src_h * scale)
        img_r  = splash.resize((new_w, new_h), Image.LANCZOS)
        x_off  = (new_w - w) // 2
        y_off  = (new_h - h) // 2
        img_c  = img_r.crop((x_off, y_off, x_off + w, y_off + h))
        canvas = Image.new('RGB', (w, h), BG_COLOR[:3])
        canvas.paste(img_c, (0, 0), img_c.convert('RGBA'))
    else:
        # Fallback: icon centered on solid background
        canvas  = Image.new('RGB', (w, h), BG_COLOR[:3])
        icon_sz = int(min(w, h) * 0.45)
        icon_r  = icon.resize((icon_sz, icon_sz), Image.LANCZOS)
        canvas.paste(icon_r, ((w - icon_sz) // 2, (h - icon_sz) // 2), icon_r)
    canvas.save(out_path, 'PNG')
    print(f'  res/screen/android/{density}.png  ({w}x{h})')

# ─── 3. Adaptive icons → platforms/ (not handled by config.xml <icon> tags) ──
# These are only written if platforms/android already exists (i.e. after first build).
# On a fresh clone run `cordova prepare android` first, then re-run this script.
if os.path.isdir(PLATFORM_RES):
    print('Generating adaptive icons → platforms/android/...')

    # ic_launcher_foreground.png
    for density, size in ADAPTIVE_DENSITIES.items():
        folder   = os.path.join(PLATFORM_RES, MIPMAP_V26[density])
        os.makedirs(folder, exist_ok=True)
        out_path = os.path.join(folder, 'ic_launcher_foreground.png')
        canvas   = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        icon_sz  = int(size * 0.66)
        offset   = (size - icon_sz) // 2
        canvas.paste(icon.resize((icon_sz, icon_sz), Image.LANCZOS), (offset, offset), icon.resize((icon_sz, icon_sz), Image.LANCZOS))
        canvas.save(out_path, 'PNG')
        print(f'  {MIPMAP_V26[density]}/ic_launcher_foreground.png')

    # ic_launcher_background.png
    for density, size in ADAPTIVE_DENSITIES.items():
        folder   = os.path.join(PLATFORM_RES, MIPMAP_V26[density])
        out_path = os.path.join(folder, 'ic_launcher_background.png')
        Image.new('RGB', (size, size), BG_COLOR[:3]).save(out_path, 'PNG')
        print(f'  {MIPMAP_V26[density]}/ic_launcher_background.png')

    # mipmap-anydpi-v26/ic_launcher.xml
    anydpi_dir = os.path.join(PLATFORM_RES, 'mipmap-anydpi-v26')
    os.makedirs(anydpi_dir, exist_ok=True)
    with open(os.path.join(anydpi_dir, 'ic_launcher.xml'), 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n'
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                '    <background android:drawable="@color/ic_launcher_background"/>\n'
                '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
                '</adaptive-icon>\n')
    print('  mipmap-anydpi-v26/ic_launcher.xml')

    # Patch colors.xml
    colors_file = os.path.join(PLATFORM_RES, 'values', 'colors.xml')
    if os.path.exists(colors_file):
        colors = open(colors_file).read()
        if 'ic_launcher_background' not in colors:
            colors = colors.replace('</resources>', '    <color name="ic_launcher_background">#1a1040</color>\n</resources>')
            open(colors_file, 'w').write(colors)
else:
    print('SKIP adaptive icons — platforms/android not found (run cordova prepare first)')

# ─── 4. Copy icon to www/img for web reference ───────────────────────────────
shutil.copy(ICON_SRC, os.path.join(ROOT, 'www', 'img', 'logo.png'))
print('Copied icon to www/img/logo.png')

print('\nDone!')
