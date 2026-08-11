#!/bin/zsh
# Render wireframe HTML files to 1600x900 PNGs (2x) with headless Chromium.
# Chromium does not always exit after --screenshot, so it is backgrounded and reaped.
cd "$(dirname "$0")"
BIN=/opt/homebrew/bin/chromium
TMP=$(mktemp -d)
for f in "$@"; do
  base="${f%.html}"
  out="$PWD/$base.png"
  rm -f "$out"
  "$BIN" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=2 --virtual-time-budget=3000 --window-size=1600,988 \
    --user-data-dir="$TMP/$base" --screenshot="$out" "file://$PWD/$f" >/dev/null 2>&1 &
  pid=$!
  for i in {1..40}; do
    [ -s "$out" ] && sleep 0.4 && break
    sleep 0.5
  done
  kill $pid 2>/dev/null; wait $pid 2>/dev/null
  if [ -s "$out" ]; then
    /opt/homebrew/bin/magick "$out" -crop 3200x1800+0+0 +repage "$out"
    echo "$base.png  $(/usr/bin/sips -g pixelWidth -g pixelHeight "$out" | tail -2 | tr -s ' \n' ' ')"
  else
    echo "$base.png  FAILED"
  fi
done
rm -rf "$TMP"
