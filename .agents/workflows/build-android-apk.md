---
description: How to build an Android APK locally
---

# Build Android APK (Local Build)

## Prerequisites (already installed)
- Java 21 (`C:\Program Files\Java\jdk-21.0.10`)
- Android SDK at `F:\Android\Sdk` (with platform-tools, build-tools 35+36, platforms 35+36, NDK 27)
- Environment variables: `ANDROID_HOME=F:\Android\Sdk`, `ANDROID_SDK_ROOT=F:\Android\Sdk`

## Steps

### 1. Set environment variables (needed each terminal session)
// turbo
```
$env:ANDROID_HOME = 'F:\Android\Sdk'; $env:ANDROID_SDK_ROOT = 'F:\Android\Sdk'
```

### 2. Generate/update native Android project
// turbo
```
npx expo prebuild --platform android --clean
```
This generates the `android/` folder from `app.json` config. Use `--clean` to regenerate from scratch.

### 3. Build the release APK
```
cd android; .\gradlew.bat assembleRelease 2>&1 | Tee-Object -FilePath F:\Android\build_log.txt; cd ..
```
First build takes ~6 minutes (native C++ compilation). Subsequent builds are ~2 minutes.

### 4. Find and copy the APK
// turbo
```
Copy-Item "android\app\build\outputs\apk\release\app-release.apk" "GoatCitadel.apk" -Force; echo "APK ready: GoatCitadel.apk ($([math]::Round((Get-Item GoatCitadel.apk).Length / 1MB, 1)) MB)"
```

### 5. Install on phone
Transfer `GoatCitadel.apk` to your Android phone and tap to install.
You may need to enable "Install from unknown sources" in Android settings.

## Notes
- The APK is at `android\app\build\outputs\apk\release\app-release.apk`
- For a debug build use `assembleDebug` instead of `assembleRelease`
- If you change `app.json` (icons, package name, plugins), re-run step 2
- For code-only changes, just re-run step 3 (no need for prebuild)
- The `punycode` npm package must be installed (already is) for markdown support
