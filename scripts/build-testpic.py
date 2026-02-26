#!/usr/bin/env python3
"""
Generates www/index.html from testpic source for Cordova build.
Transformations:
  1. $BACKEND_PUBLICK_SDK_URL → game-sdk.umd.js
  2. $REACT_APP_BACKEND_URL_GAME_CONFIG → https://stage-configs.artintgames.com
  3. Remove `if (window.cordova) { LEVELS = FALLBACK } else {` guard
     → Cordova also loads real levels from config service
  4. Remove `!window.cordova &&` from the ads re-apply condition
     → Cordova also re-applies mock config after initConfigs
"""
import os, shutil, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, '..', 'game-core-sdk-frontend', 'public', 'game', 'testpic', 'index.html')
DEST = os.path.join(ROOT, 'www', 'index.html')
STAGE_URL = 'https://stage-configs.artintgames.com'

# --- 1. Copy SDK UMD bundle (prefer game-core-sdk-frontend/public/sdk/1.0.108) ---
sdk_pattern = os.path.join(ROOT, '..', 'game-core-sdk-frontend', 'public', 'sdk', '1.0.108', 'game-sdk.umd.*.js')
sdk_files = sorted(glob.glob(sdk_pattern))
if not sdk_files:
    # fallback: any version in public/sdk
    sdk_pattern2 = os.path.join(ROOT, '..', 'game-core-sdk-frontend', 'public', 'sdk', '**', 'game-sdk.umd.*.js')
    sdk_files = sorted(glob.glob(sdk_pattern2, recursive=True))
if not sdk_files:
    print('ERROR: game-sdk.umd.*.js not found', file=sys.stderr)
    sys.exit(1)
sdk_src = sdk_files[-1]
shutil.copy(sdk_src, os.path.join(ROOT, 'www', 'game-sdk.umd.js'))
print(f'SDK copied: {os.path.relpath(sdk_src, ROOT)} → www/game-sdk.umd.js')

# --- 2. Read source HTML ---
with open(SRC, 'r', encoding='utf-8') as f:
    html = f.read()

# --- 3. Replace template vars ---
html = html.replace('$BACKEND_PUBLICK_SDK_URL', 'game-sdk.umd.js')
html = html.replace('$REACT_APP_BACKEND_URL_GAME_CONFIG', STAGE_URL)
print('Template vars replaced')

# --- 4. Remove cordova LEVELS guard (exact string replacement) ---
OLD_LEVELS = """\
  // In Cordova use fallback levels; in browser load from stage config service
  let LEVELS;
  if (window.cordova) {
    console.log('[GAME] cordova mode — using fallback levels');
    LEVELS = TESTPIC_FALLBACK_LEVELS;
  } else {
    try {
      const configResult = await coreSDK.initConfigs({ version: '2.0.0', keys: ['testpic-init'] });
      LEVELS = configResult.get('testpic-init.LEVELS') || TESTPIC_FALLBACK_LEVELS;
      console.log('[GAME] LEVELS from config, count:', LEVELS.length);
    } catch(e) {
      console.error('[GAME] initConfigs failed:', e);
      LEVELS = TESTPIC_FALLBACK_LEVELS;
    }
  }"""

NEW_LEVELS = """\
  // Load levels from config service (both web and Cordova)
  let LEVELS;
  try {
    const configResult = await coreSDK.initConfigs({ version: '2.0.0', keys: ['testpic-init'] });
    LEVELS = configResult.get('testpic-init.LEVELS') || TESTPIC_FALLBACK_LEVELS;
    console.log('[GAME] LEVELS from config, count:', LEVELS.length);
  } catch(e) {
    console.error('[GAME] initConfigs failed:', e);
    LEVELS = TESTPIC_FALLBACK_LEVELS;
  }"""

if OLD_LEVELS in html:
    html = html.replace(OLD_LEVELS, NEW_LEVELS)
    print('Cordova LEVELS guard removed — initConfigs will run in Cordova too')
else:
    print('WARNING: cordova LEVELS guard not found — skipping (source may have changed)')

# --- 5. Remove !window.cordova condition from ads re-apply ---
old = 'if (!window.cordova && typeof APPLOVIN_ADS_CONFIG'
new = 'if (typeof APPLOVIN_ADS_CONFIG'
if old in html:
    html = html.replace(old, new)
    print('Removed !window.cordova from ads re-apply condition')
else:
    print('WARNING: ads re-apply condition not found — skipping')

# --- 6. Inject Cordova native Google Sign-In override (before </body>) ---
# In Cordova WebView, Google GSI popup is blocked by Google (since 2019).
# Use cordova-plugin-googleplus for native Android Google Sign-In instead.
CORDOVA_GOOGLE_AUTH = '''<script>
(function() {
  if (!window.cordova) return;
  var WEB_CLIENT_ID = '660405658458-a7nlkksb8s2b8341bubgien9ojgei5f9.apps.googleusercontent.com';
  document.addEventListener('deviceready', function() {
    if (!window.plugins || !window.plugins.googleplus) {
      console.warn('[GoogleAuth] cordova-plugin-googleplus not available');
      return;
    }
    if (typeof coreSDK === 'undefined') {
      console.warn('[GoogleAuth] coreSDK not available for Google auth override');
      return;
    }
    coreSDK.getGoogleIdToken = function() {
      return new Promise(function(resolve, reject) {
        window.plugins.googleplus.login(
          { webClientId: WEB_CLIENT_ID, offline: true },
          function(obj) {
            console.log('[GoogleAuth] native login OK:', obj.email);
            resolve({ credential: obj.idToken });
          },
          function(err) {
            console.error('[GoogleAuth] native login failed:', err);
            reject(new Error('Google Sign-In failed: ' + String(err)));
          }
        );
      });
    };
    console.log('[GoogleAuth] Cordova native Google Sign-In override installed');
  }, { once: true });
})();
</script>
</body>'''

if '</body>' in html:
    html = html.replace('</body>', CORDOVA_GOOGLE_AUTH)
    print('Cordova Google Sign-In override injected')
else:
    print('WARNING: </body> not found — Google auth override not injected')

# --- 7. Write output ---
with open(DEST, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'Written: www/index.html ({len(html):,} chars)')
