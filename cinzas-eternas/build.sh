#!/usr/bin/env bash
# Compila o APK de Cinzas Eternas sem Gradle (aapt2 + javac + d8 + apksigner).
# Requer: JDK 17+, Android SDK com platforms;android-34 e build-tools;35.0.0, Python3 + Pillow.
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
BT="$SDK/build-tools/35.0.0"; JAR="$SDK/platforms/android-34/android.jar"
OUT=build; rm -rf "$OUT"; mkdir -p "$OUT"/{res,gen,classes,dex,assets}
python3 android/make_icons.py "$OUT/res"
cp web/index.html web/game.js "$OUT/assets/"
"$BT/aapt2" compile --dir "$OUT/res" -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$JAR" --manifest android/AndroidManifest.xml \
  -A "$OUT/assets" --java "$OUT/gen" --min-sdk-version 24 --target-sdk-version 34 \
  --version-code 1 --version-name 1.0 "$OUT/res.zip"
javac -nowarn -source 11 -target 11 -Xlint:-options -classpath "$JAR" -d "$OUT/classes" \
  $(find android/src "$OUT/gen" -name '*.java')
"$BT/d8" --release --min-api 24 --lib "$JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
cp "$OUT/base.apk" "$OUT/unsigned.apk"; (cd "$OUT/dex" && zip -q -j ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
KS=android/debug.keystore
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storepass android -keypass android -alias cinzas \
  -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Cinzas Eternas" >/dev/null 2>&1
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android --out CinzasEternas.apk "$OUT/aligned.apk"
"$BT/apksigner" verify CinzasEternas.apk && echo "OK -> $(pwd)/CinzasEternas.apk ($(du -h CinzasEternas.apk | cut -f1))"
