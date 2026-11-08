#!/usr/bin/env bash
# Fast, color-safe DIN Couture Reel builder (logo + Article Code SKU + optional caption).
# Requires: ffmpeg, logo PNG with alpha, input video, SKU string.
# Does NOT download AI models. Preserves garment colors (no LUTs / no eq filter).
set -euo pipefail

IN="${1:?usage: $0 input.mp4 SKU [logo.png] [caption.txt] [out.mp4]}"
SKU="${2:?SKU required}"
LOGO="${3:-din-logo.png}"
CAPTION_FILE="${4:-}"
OUT="${5:-reel_${SKU}_9x16.mp4}"
LABEL="Article Code: ${SKU}"

# Scale+pad to 1080x1920 without stretch; overlay logo top-right; SKU bottom plate.
FILTER="scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black"
FILTER+=",drawbox=x=0:y=ih-160:w=iw:h=140:color=black@0.45:t=fill"
FILTER+=",drawtext=text='${LABEL}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-110"

if [[ -f "$LOGO" ]]; then
  ffmpeg -y -i "$IN" -i "$LOGO" \
    -filter_complex "[0:v]${FILTER}[base];[1:v]scale=180:-1[lg];[base][lg]overlay=W-w-40:40[v]" \
    -map '[v]' -map 0:a? -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a aac -shortest "$OUT"
else
  ffmpeg -y -i "$IN" -vf "$FILTER" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a aac -shortest "$OUT"
fi

echo "Wrote $OUT"
[[ -n "$CAPTION_FILE" ]] && echo "Caption file (for n8n post text, not burned): $CAPTION_FILE"
