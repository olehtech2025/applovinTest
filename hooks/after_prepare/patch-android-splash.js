#!/usr/bin/env node
/**
 * After prepare hook: patches Android splash screen
 * - Copies density-specific splash images from res/screen/android/ to platforms/drawable-DENSITY/screen.png
 *   (Cordova 14 ignores splash tags, so we do it manually here)
 * - Sets dark purple background (#1a1040) for native Android 12+ splash
 * - Uses our app icon as the native splash icon
 */
var fs   = require('fs');
var path = require('path');

module.exports = function(context) {
  var projectRoot = context.opts.projectRoot;
  var resPath = path.join(
    projectRoot,
    'platforms', 'android', 'app', 'src', 'main', 'res'
  );

  // 1. Copy density-specific splash images (Cordova 14 ignores <splash> tags)
  var splashSrcDir = path.join(projectRoot, 'res', 'screen', 'android');
  var densities = ['ldpi', 'mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  var copied = 0;
  densities.forEach(function(density) {
    var src  = path.join(splashSrcDir, density + '.png');
    var dest = path.join(resPath, 'drawable-' + density, 'screen.png');
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      copied++;
    }
  });
  // Also copy to drawable/ (default fallback)
  var defaultSrc  = path.join(splashSrcDir, 'xxxhdpi.png');
  var defaultDest = path.join(resPath, 'drawable', 'screen.png');
  if (fs.existsSync(defaultSrc)) {
    fs.copyFileSync(defaultSrc, defaultDest);
  }
  console.log('[hook] Copied ' + copied + ' splash images -> platforms/drawable-*/screen.png');

  // 2. Fix background color in colors.xml
  var colorsFile = path.join(resPath, 'values', 'colors.xml');
  if (fs.existsSync(colorsFile)) {
    var colors = fs.readFileSync(colorsFile, 'utf8');
    colors = colors.replace(
      /<color name="cdv_splashscreen_background">[^<]*<\/color>/,
      '<color name="cdv_splashscreen_background">#1a1040</color>'
    );
    fs.writeFileSync(colorsFile, colors);
    console.log('[hook] Patched colors.xml: cdv_splashscreen_background -> #1a1040');
  }

  // 3. Replace ic_cdv_splashscreen.xml with bitmap pointing to our icon
  var splashDrawable = path.join(resPath, 'drawable', 'ic_cdv_splashscreen.xml');
  var bitmapXml = '<?xml version="1.0" encoding="utf-8"?>\n'
    + '<bitmap xmlns:android="http://schemas.android.com/apk/res/android"\n'
    + '    android:src="@mipmap/ic_launcher"\n'
    + '    android:gravity="center" />\n';
  fs.writeFileSync(splashDrawable, bitmapXml);
  console.log('[hook] Replaced ic_cdv_splashscreen.xml with ic_launcher bitmap');
};
