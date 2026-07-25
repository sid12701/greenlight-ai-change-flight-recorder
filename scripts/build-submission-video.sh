#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
video_tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/greenlight-video.XXXXXX")"
trap 'rm -rf "$video_tmp_dir"' EXIT

output="$repo_root/signoz-hackathon-end-to-end-demo.mp4"
narration="$repo_root/assets/video/narration.txt"
human_narration="$repo_root/assets/video/human-narration.m4a"
captions="$repo_root/assets/video/captions.srt"
audio="$video_tmp_dir/narration.wav"
concat_list="$video_tmp_dir/concat.txt"

command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
command -v say >/dev/null

if [[ -s "$human_narration" ]]; then
  ffmpeg -hide_banner -loglevel error -y \
    -i "$human_narration" \
    -af "atempo=1.052,loudnorm=I=-16:TP=-1.5:LRA=11" \
    -ar 48000 -ac 2 "$audio"
else
  say -r 155 -f "$narration" -o "$audio"
  if [[ "$(stat -f%z "$audio")" -le 4096 ]]; then
    echo "Narration synthesis produced no audio. Run this script with permission to use macOS speech synthesis." >&2
    exit 1
  fi
fi

images=(
  "assets/screenshots/greenlight-overview.jpg"
  "assets/screenshots/greenlight-regression-receipt.jpg"
  "assets/screenshots/greenlight-regression-impact.jpg"
  "assets/architecture/greenlight-architecture.png"
  "assets/screenshots/signoz-deployment-impact-dashboard.jpg"
  "assets/screenshots/signoz-slow-trace.jpg"
  "assets/screenshots/signoz-p95-alert-history.jpg"
  "assets/screenshots/signoz-correlated-logs.jpg"
  "assets/screenshots/signoz-self-observability-dashboard.jpg"
  "assets/screenshots/greenlight-overview.jpg"
)

durations=(13 18 18 16 18 13 15 13 12 9)

: > "$concat_list"
for index in "${!images[@]}"; do
  image="$repo_root/${images[$index]}"
  duration="${durations[$index]}"
  clip="$video_tmp_dir/clip-$index.mp4"
  fade_out="$(awk -v d="$duration" 'BEGIN { printf "%.2f", d - 0.35 }')"

  ffmpeg -hide_banner -loglevel error -y \
    -loop 1 -framerate 30 -t "$duration" -i "$image" \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x060a0c,fade=t=in:st=0:d=0.35,fade=t=out:st=${fade_out}:d=0.35,format=yuv420p" \
    -an -r 30 -c:v libx264 -preset medium -crf 19 -movflags +faststart "$clip"

  printf "file '%s'\n" "$clip" >> "$concat_list"
done

ffmpeg -hide_banner -loglevel error -y \
  -f concat -safe 0 -i "$concat_list" \
  -i "$audio" \
  -af "apad=pad_dur=145" \
  -t 145 \
  -c:v copy \
  -c:a aac -b:a 160k -ar 48000 -ac 2 \
  -movflags +faststart "$output"

ffprobe -v error \
  -show_entries format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels \
  -of json "$output"
