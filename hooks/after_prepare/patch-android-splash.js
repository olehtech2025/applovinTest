#!/usr/bin/env node
/**
 * After prepare hook: patches Android native splash screen (Android 12+)
 * - Sets dark purple background (#1a1040) instead of white
 * - Uses our app icon as the splash icon
 */
const fs = require('fs');
const path = require('path');

module.exports = function(context) {
  const resPath = path.join(
    context.opts.projectRoot,
    'platforms', 'android', 'app', 'src', 'main', 'res'
  );

  // 1. Fix background color in colors.xml
  const colorsFile = path.join(resPath, 'values', 'colors.xml');
  if (fs.existsSync(colorsFile)) {
    let colors = fs.readFileSync(colorsFile, 'utf8');
    colors = colors.replace(
      /<color name="cdv_splashscreen_background">[^<]*<\/color>/,
      '<color name="cdv_splashscreen_background">#1a1040</color>'
    );
    fs.writeFileSync(colorsFile, colors);
    console.log('[hook] Patched colors.xml: cdv_splashscreen_background → #1a1040');
  }

  // 2. Replace ic_cdv_splashscreen.xml with bitmap pointing to our icon
  const splashDrawable = path.join(resPath, 'drawable', 'ic_cdv_splashscreen.xml');
  const bitmapXml = `<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@mipmap/ic_launcher"
    android:gravity="center" />
`;
  fs.writeFileSync(splashDrawable, bitmapXml);
  console.log('[hook] Replaced ic_cdv_splashscreen.xml with ic_launcher bitmap');
};
