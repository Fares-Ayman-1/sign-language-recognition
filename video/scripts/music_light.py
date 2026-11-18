"""Light cut: synthesize an original music bed and sound effects from video/scenes-light.json.

Adapted from the series kit's music.py (_video-kit/scripts/music.py): same synth, but the scenes file and the
output names are arguments, so the dark cut's public/music.mp3 and public/sfx.mp3 are never touched.

Usage (from the project root):
  uv run --no-sync python video/scripts/music_light.py --root A --mode minor --bpm 96
Needs numpy, scipy and ffmpeg on PATH. Writes public/music-light.mp3 and public/sfx-light.mp3 by default.

The scenes file is a list of {"key", "dur"} (frames at 30 fps, 10-frame cross-fades), with optional cues:
  "energy": 0-3   0 pad only, 1 + sub bass, 2 + arpeggio, 3 + drums (default 1)
  "riser": true   a noise riser into the start of this scene and a low boom on its first frame
  "boom": true    a softer boom on the first frame (no riser)
  "ticks": [f, ...]  soft ticks at these frames (relative to the scene start), e.g. bars landing
  "whoosh": false    no whoosh on the cut into this scene (default true, except the first scene)
"""

from __future__ import annotations

import argparse
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
FPS = 30
OVERLAP = 10
HERE = Path(__file__).resolve().parents[1]
NOTES = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}
# Two-bar chords as (semitones above the tonic for the pad voicing, bass degree)
PROGRESSIONS = {
    # i VI III VII
    "minor": [([0, 3, 7, 12], 0), ([-4, 0, 3, 8], -4), ([-2, 3, 7, 10], 3), ([-2, 2, 5, 10], -2)],
    # I V vi IV
    "major": [([0, 4, 7, 12], 0), ([-1, 2, 7, 11], 7), ([-3, 0, 4, 9], -3), ([-7, 0, 5, 9], 5)],
}

ap = argparse.ArgumentParser()
ap.add_argument("--root", default="A")
ap.add_argument("--mode", default="minor", choices=list(PROGRESSIONS))
ap.add_argument("--bpm", type=float, default=96)
ap.add_argument("--seed", type=int, default=7)
ap.add_argument("--scenes", default="scenes-light.json", help="scenes file, relative to video/")
ap.add_argument("--music-out", default="music-light", help="music file name in public/, without .mp3")
ap.add_argument("--sfx-out", default="sfx-light", help="sound-effects file name in public/, without .mp3")
args = ap.parse_args()
if {args.music_out, args.sfx_out} & {"music", "sfx"}:
    ap.error("music/sfx are the dark cut's files; pick other names")

scenes = json.loads((HERE / args.scenes).read_text(encoding="utf-8"))
start: dict[str, float] = {}
at = 0
for s in scenes:
    start[s["key"]] = at / FPS
    at += s["dur"] - OVERLAP
TOTAL = (at + OVERLAP) / FPS
N = int(TOTAL * SR) + SR
t_all = np.arange(N) / SR
rng = np.random.default_rng(args.seed)
TONIC = 57 + (NOTES[args.root] - NOTES["A"])  # around A3
BEAT = 60 / args.bpm
BAR = 4 * BEAT
SEG = 2 * BAR
CHORDS = PROGRESSIONS[args.mode]


def hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x: np.ndarray, f: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x, axis=0)


def hp(x: np.ndarray, f: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x, axis=0)


def bp(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def saw(f: float, t: np.ndarray, phase: float = 0.0) -> np.ndarray:
    return 2 * ((f * t + phase) % 1.0) - 1


def tri(f: float, t: np.ndarray) -> np.ndarray:
    return 2 * np.abs(saw(f, t)) - 1


def put(buf: np.ndarray, sig: np.ndarray, at_s: float) -> None:
    i = int(at_s * SR)
    if i < 0 or i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def stereo(x: np.ndarray, pan: float = 0.0) -> np.ndarray:
    return np.stack([x * np.sqrt(0.5 * (1 - pan)), x * np.sqrt(0.5 * (1 + pan))], axis=1)


def env_ar(n: int, a: float, r: float) -> np.ndarray:
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def band_sweep(x: np.ndarray, f_of_p, blk: int = 1024) -> np.ndarray:
    y = np.zeros(len(x))
    for i in range(0, len(x), blk):
        f = f_of_p(i / len(x))
        seg = bp(x[max(0, i - 2 * blk) : i + blk], f * 0.6, min(f * 1.6, 18000))
        y[i : i + blk] = seg[-len(y[i : i + blk]) :]
    return y


# energy automation: per scene level, smoothed over ~1.5 s
lvl = np.zeros(N)
for s in scenes:
    a = int(start[s["key"]] * SR)
    b = int((start[s["key"]] + s["dur"] / FPS) * SR)
    lvl[a:b] = s.get("energy", 1)
k = int(1.5 * SR)
lvl = np.convolve(lvl, np.ones(k) / k, mode="same")
fade = np.interp(t_all, [0, 1.5, TOTAL - 3, TOTAL], [0, 1, 1, 0])


def layer(threshold: float) -> np.ndarray:
    return np.clip(lvl - threshold + 1, 0, 1)


music = np.zeros((N, 2))
n_seg = int(np.ceil(TOTAL / SEG)) + 1

# pad: detuned saws, low-pass opening with energy
pad = np.zeros((N, 2))
for s in range(n_seg):
    voicing, _ = CHORDS[s % 4] if s * SEG < TOTAL - 8 else CHORDS[0]
    n = int((SEG + 1.5) * SR)
    tt = np.arange(n) / SR
    x = np.zeros((n, 2))
    for m in voicing:
        for d, pan in [(-0.09, -0.6), (0.0, 0.0), (0.08, 0.6)]:
            x += stereo(saw(hz(TONIC + m + d), tt, rng.random()), pan) * 0.06
    put(pad, x * env_ar(n, 1.2, 1.5)[:, None], s * SEG)
cut = 600 + 900 * np.clip(lvl, 0, 3)
blk = SR // 4
out = np.zeros_like(pad)
for i in range(0, N, blk):
    sl = slice(max(0, i - SR // 8), min(N, i + blk))
    y = lp(pad[sl], float(cut[min(N - 1, i)]), 2)
    out[i : min(N, i + blk)] = y[i - sl.start : i - sl.start + min(blk, N - i)]
music += out * 0.9

# sub bass
bass = np.zeros(N)
for s in range(n_seg):
    _, deg = CHORDS[s % 4] if s * SEG < TOTAL - 8 else CHORDS[0]
    n = int((SEG + 0.3) * SR)
    tt = np.arange(n) / SR
    root = TONIC - 12 + deg
    tone = np.sin(2 * np.pi * hz(root - 12) * tt) * 0.5 + np.sin(2 * np.pi * hz(root) * tt) * 0.12
    put(bass, tone * env_ar(n, 0.4, 0.4), s * SEG)
music += stereo(bass * 0.2 * layer(1))

# arpeggio: plucked triangle 16ths over the chord tones
arp = np.zeros((N, 2))
pattern = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2]
pl = int(0.22 * SR)
tt = np.arange(pl) / SR
step, t0, i = BEAT / 4, 0.0, 0
while t0 < TOTAL:
    voicing, _ = CHORDS[int(t0 // SEG) % 4]
    accent = 1.0 if i % 4 == 0 else 0.7
    note = tri(hz(TONIC + voicing[pattern[i % 16]] + 12), tt) * np.exp(-tt / 0.07) * accent
    put(arp, stereo(note, 0.35 * np.sin(i * 0.7)), t0)
    t0 += step
    i += 1
music += lp(arp, 4500) * 0.10 * layer(2)[:, None]

# drums: half-time kick, offbeat hats
drums = np.zeros(N)
kt = np.arange(int(0.4 * SR)) / SR
kick = np.sin(2 * np.pi * (45 * kt + 75 * 0.04 * (1 - np.exp(-kt / 0.04)))) * np.exp(-kt / 0.12)
hl = int(0.04 * SR)
hat = hp(rng.standard_normal(hl), 7000) * np.exp(-np.arange(hl) / SR / 0.012)
for tk in np.arange(0, TOTAL, 2 * BEAT):
    put(drums, kick * 0.9, tk)
for th in np.arange(BEAT / 2, TOTAL, BEAT):
    put(drums, hat * 0.25, th)
music += stereo(drums * 0.55 * layer(3))

# risers into scenes marked "riser"
for s in scenes:
    if s.get("riser"):
        rl = int(2.2 * SR)
        rt = np.arange(rl) / SR
        r = band_sweep(rng.standard_normal(rl), lambda p: 300 + 5700 * p**2, 2048) * (rt / rt[-1]) ** 2 * 0.35
        put(music, stereo(r), start[s["key"]] - 2.2)

# reverb (synthetic stereo IR)
irl = int(2.8 * SR)
it = np.arange(irl) / SR
noise2 = np.stack([rng.standard_normal(irl), rng.standard_normal(irl)], 1)
ir = lp(noise2 * np.exp(-it / 0.7)[:, None], 6000) * 0.02
music = music + np.stack([fftconvolve(music[:, c], ir[:, c])[:N] for c in range(2)], 1) * 0.6
music *= fade[:, None]

# ---------------------------------------------------------------------------------------- sound effects
sfx = np.zeros((N, 2))


def whoosh(dur: float = 0.55, lo: float = 400, hi: float = 4000, gain: float = 0.18) -> np.ndarray:
    n = int(dur * SR)
    y = band_sweep(rng.standard_normal(n), lambda p: lo + (hi - lo) * np.sin(np.pi * p))
    return y * np.sin(np.pi * np.linspace(0, 1, n)) ** 2 * gain


def boom(gain: float) -> np.ndarray:
    tt = np.arange(int(1.6 * SR)) / SR
    body = np.sin(2 * np.pi * (38 * tt + 60 * 0.08 * (1 - np.exp(-tt / 0.08)))) * np.exp(-tt / 0.45)
    return (body + lp(rng.standard_normal(len(tt)), 1200) * np.exp(-tt / 0.15) * 0.25) * gain


def tick(f: float = 2400, gain: float = 0.12) -> np.ndarray:
    tt = np.arange(int(0.06 * SR)) / SR
    return np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.012) * gain


for n_s, s in enumerate(scenes):
    t = start[s["key"]]
    if n_s > 0 and s.get("whoosh", True):
        w = whoosh()
        put(sfx, np.stack([w, np.roll(w, 300)], 1), t - 0.15)
    if s.get("riser"):
        put(sfx, stereo(boom(0.55)), t)
    elif s.get("boom"):
        put(sfx, stereo(boom(0.35)), t + 8 / FPS)
    for j, fr in enumerate(s.get("ticks", [])):
        put(sfx, stereo(tick(2200 + 120 * (j % 5), 0.1), ((j % 3) - 1) * 0.4), t + fr / FPS)


def master(x: np.ndarray, peak_db: float) -> np.ndarray:
    x = np.tanh(hp(x, 28) * 1.2) / np.tanh(1.2)
    return x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)


def write(x: np.ndarray, name: str) -> None:
    pub = HERE / "public"
    pub.mkdir(exist_ok=True)
    wav = pub / f"{name}.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-b:a", "320k", str(pub / f"{name}.mp3")]
    subprocess.run(cmd, check=True)
    wav.unlink()
    print("wrote", pub / f"{name}.mp3")


write(master(music[: int(TOTAL * SR)], -1.0), args.music_out)
write(master(sfx[: int(TOTAL * SR)], -3.0), args.sfx_out)
print(f"{args.scenes}: timeline {TOTAL:.2f} s, {args.root} {args.mode}, {args.bpm:g} BPM")
