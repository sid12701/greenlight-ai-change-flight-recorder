# Final demo video

The finished submission video is
[`signoz-hackathon-end-to-end-demo.mp4`](../signoz-hackathon-end-to-end-demo.mp4).
It is 2:25, 1920×1080, H.264 High Profile with stereo AAC audio at 48 kHz.

The exact narration is
[`assets/video/narration.txt`](../assets/video/narration.txt). The matching
YouTube-ready caption file is
[`assets/video/captions.srt`](../assets/video/captions.srt).

Rebuild it locally after updating any screenshot:

```bash
scripts/build-submission-video.sh
```

The builder uses the recorded human narration in
`assets/video/human-narration.m4a`, applies the documented 5.2% timing
adjustment and loudness normalization, and uses FFmpeg for deterministic scene
timing and H.264/AAC encoding. macOS `say` remains the fallback when the human
recording is absent. The builder finishes by printing the codec, resolution,
duration, channel count, and file size from `ffprobe`.

The video deliberately uses screenshots captured from the verified live stack.
No screenshot claims alert-webhook delivery, a populated service map, or a
linked AI session. Those remain documented limitations.

See [`DEMO_STORYBOARD.md`](DEMO_STORYBOARD.md) for the screen-by-screen story
and the expected audience response.
