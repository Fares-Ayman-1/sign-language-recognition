# Project video

A 92-second explainer built with [Remotion](https://www.remotion.dev/) (React → MP4). Every skeleton on
screen is a real held-out signer's MediaPipe landmarks, every prediction is `model.onnx` run on that
recording, and every number is read from `reports/metrics.json` and `models/run/baseline.json`.

| Output | Size | Use |
|---|---|---|
| `out/asl-wide.mp4` | 1920 × 1080 | YouTube, GitHub README, portfolio site |
| `out/asl-square.mp4` | 1080 × 1080 | LinkedIn feed |
| `out/asl-vertical.mp4` | 1080 × 1920 | Reels / Shorts (`npm run render:vertical`, not reviewed yet) |

## Rebuild

```bash
cd ..   # project root
uv run python video/scripts/extract.py     # -> video/public/clips.json (needs data/raw + models/)
cd video
npm install
npm run studio                              # live preview in the browser
npm run render:wide
npm run render:square
```

`public/clips.json` is derived from the competition data, so it is git-ignored like the rest of `data/`.

## Demo recording, music and sound

All three are generated, so there is nothing to license:

```bash
# real demo page, screen-recorded in headless Chrome (needs the API on :8030)
cd ..; uv run python video/scripts/demo_json.py; cd video
node scripts/capture_demo.mjs
ffmpeg -i capture/demo.webm -vf "fps=30,format=yuv420p" -c:v libx264 -crf 14 public/demo.mp4
# original music bed + sound effects, timed to the scenes (A minor, 96 BPM)
cd ..; uv run python video/scripts/music.py
```

- `public/demo.mp4`: the real `/demo/` page replaying three held-out signers through `window.islr`. The
  predictions on screen are ONNX Runtime Web's own output, identical to the Python API. To use a webcam
  recording of yourself instead, replace this file (same name) and re-render.
- `public/music.mp3`, `public/sfx.mp3`: synthesized by `scripts/music.py` with whooshes on cuts, ticks
  on counters and bars, and a riser into the results. If you change scene durations in `src/Main.tsx`,
  mirror them in `SCENES` at the top of `music.py`.

The video uses whichever of these files exist in `public/`.

## Scenes

hook (543 points) · question · live demo · data and signer split · 543 → 89 points · mirroring
left-handers · 398 × 64 features · Conv1D + Transformer · one ONNX file · held-out results · where it fails
(awake ↔ wake) · engineering · outro. Durations are in `src/Main.tsx`.

## Light version

`WideLight` (1920 × 1080) and `SquareLight` (1080 × 1080) tell the same story in the series' light look
(the shared kit from `_video-kit`, copied to `src/kit/`): cream ground, white cards, navy Sora headlines,
gold only as fills (one highlighter word per headline), mono gold-hairline pills, brand easing, no logo.
It opens with the series title (Week 1 of 4) and ends with the series outro (next week: GI Tract MRI
Segmentation). The dark `Wide`, `Square` and `Vertical` compositions and their files are unchanged.

| Output | Command |
|---|---|
| `out/asl-wide-light.mp4` | `npm run render:wide-light` |
| `out/asl-square-light.mp4` | `npm run render:square-light` |

- Code: `src/light/` (`Main.tsx`, `num.ts`, `parts.tsx`, `scenes/`), kit in `src/kit/`. Timing lives in
  `scenes-light.json` (14 scenes, 2,695 frames, 89.8 s); the kit `Timeline` got optional `music`/`sfx` props.
- Skeleton colours (`palette` prop on `Skeleton`, off by default): dominant hand navy, other hand gold, arms
  electric blue, face mesh navy at 30%, no glow.
- Every number is read in `src/light/num.ts` from `reports/metrics.json`, `models/run/baseline.json`,
  `models/meta.json`, `public/clips.json` and the landmark layout in `src/data.ts`. Three come only from the
  project README: 21 signers (line 5), about 3% left-hand dominant (line 97), 398 features per frame (line 101).
- Demo, music and sound (API on :8030 for the demo):

```bash
node scripts/capture_demo_light.mjs     # real /demo/ page, prefers-color-scheme light -> capture/demo-light.webm
ffmpeg -i capture/demo-light.webm -vf "fps=30,format=yuv420p" -c:v libx264 -crf 14 public/demo-light.mp4
cd ..; uv run --no-sync python video/scripts/music_light.py --root A --mode minor --bpm 96; cd video
node scripts/stills.mjs WideLight 225 670 2000   # review stills -> out/stills-light/
```

`public/demo-light.mp4` is the same three held-out signers and warm-up as the dark recording. The light
script adds one invisible 1 px repaint before stopping, so the last result (radio) is kept; Puppeteer's
recorder otherwise drops the final frame. `music-light.mp3` / `sfx-light.mp3` come from `scenes-light.json`
(A minor, 96 BPM); if you change a duration there, re-run `music_light.py`.
