"""Synthesize an original music bed and sound effects timed to the video's scenes (no samples, no licences).

Run from the project root:  uv run python video/scripts/music.py
Writes video/public/music.mp3 and video/public/sfx.mp3 (via ffmpeg). Scene timings mirror src/Main.tsx.
A minor, 96 BPM, i-VI-III-VII (Am F C G), two bars per chord.
"""

from __future__ import annotations

import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "video" / "public"
SR = 44100
FPS = 30
OVERLAP = 10
SCENES = [
    ("hook", 180),
    ("question", 200),
    ("demo", 525),
    ("data", 165),
    ("points", 160),
    ("mirror", 165),
    ("features", 140),
    ("model", 165),
    ("onnx", 165),
    ("eval", 330),
    ("failure", 300),
    ("eng", 165),
    ("outro", 210),
]

start, at = {}, 0
for k, d in SCENES:
    start[k] = at / FPS
    at += d - OVERLAP
TOTAL = (at + OVERLAP) / FPS
N = int(TOTAL * SR) + SR
t_all = np.arange(N) / SR
rng = np.random.default_rng(7)

BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORDS = [  # (pad notes, bass root) as MIDI numbers
    ([57, 60, 64, 69], 45),  # Am
    ([53, 57, 60, 65], 41),  # F
    ([55, 60, 64, 67], 48),  # C
    ([55, 59, 62, 67], 43),  # G
]


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
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def stereo(x: np.ndarray, pan: float = 0.0) -> np.ndarray:
    return np.stack([x * np.sqrt(0.5 * (1 - pan)), x * np.sqrt(0.5 * (1 + pan))], axis=1)


def env_ar(n: int, a: float, r: float) -> np.ndarray:
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na) if na else 1
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def section_level(points: list[tuple[float, float]]) -> np.ndarray:
    """Piecewise-linear automation over the whole timeline from (seconds, level) points."""
    xs, ys = zip(*points, strict=True)
    return np.interp(t_all, xs, ys)


S = start
music = np.zeros((N, 2))

# ---- pad: detuned saws, dark low-pass that opens with the story, long crossfades between chords
pad = np.zeros((N, 2))
seg = 2 * BAR
n_seg = int(np.ceil(TOTAL / seg)) + 1
for s in range(n_seg):
    notes, _ = CHORDS[s % 4]
    if S["outro"] + 2 < s * seg:  # hold Am on the outro
        notes = CHORDS[0][0]
    length = seg + 1.5
    n = int(length * SR)
    tt = np.arange(n) / SR
    x = np.zeros((n, 2))
    for m in notes:
        for d, pan in [(-0.09, -0.6), (0.0, 0.0), (0.08, 0.6)]:
            x += stereo(saw(hz(m + d), tt, rng.random()), pan) * 0.06
    x *= env_ar(n, 1.2, 1.5)[:, None]
    put(pad, x, s * seg)
cut = section_level(
    [
        (0, 500),
        (S["question"], 800),
        (S["demo"], 1300),
        (S["data"], 1900),
        (S["eval"], 3200),
        (S["failure"], 1200),
        (S["eng"], 2200),
        (S["outro"], 1500),
        (TOTAL, 700),
    ]
)
# time-varying low-pass: filter in blocks with the block's cutoff
blk = SR // 4
out = np.zeros_like(pad)
for i in range(0, N, blk):
    c = float(cut[min(N - 1, i)])
    sl = slice(max(0, i - SR // 8), min(N, i + blk))
    y = lp(pad[sl], c, 2)
    out[i : min(N, i + blk)] = y[i - sl.start : i - sl.start + min(blk, N - i)]
pad = out
music += pad * section_level([(0, 0.0), (1.5, 0.9), (TOTAL - 3, 0.9), (TOTAL, 0.0)])[:, None]

# ---- sub bass: sine roots, from the question onwards
bass = np.zeros(N)
for s in range(n_seg):
    if s * seg < S["question"] - 0.5:
        continue
    root = CHORDS[s % 4][1] if s * seg < S["outro"] + 2 else CHORDS[0][1]
    n = int((seg + 0.3) * SR)
    tt = np.arange(n) / SR
    put(
        bass,
        (np.sin(2 * np.pi * hz(root - 12) * tt) * 0.5 + np.sin(2 * np.pi * hz(root) * tt) * 0.12)
        * env_ar(n, 0.4, 0.4),
        s * seg,
    )
music += stereo(
    bass
    * 0.2
    * section_level(
        [
            (0, 0),
            (S["question"], 0),
            (S["demo"], 1),
            (S["failure"], 1),
            (S["failure"] + 1, 0.55),
            (S["eng"], 1),
            (TOTAL - 2, 1),
            (TOTAL, 0),
        ]
    )
)

# ---- arp: plucked triangle 16ths over the chord tones
arp = np.zeros((N, 2))
pattern = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2]
step = BEAT / 4
pl = int(0.22 * SR)
tt = np.arange(pl) / SR
k = 0
t0 = S["demo"]
while t0 < S["outro"] + 1.0:
    notes = CHORDS[int(t0 // seg) % 4][0]
    m = notes[pattern[k % 16]] + 12
    note = tri(hz(m), tt) * np.exp(-tt / 0.07) * (1.0 if k % 4 == 0 else 0.7)
    put(arp, stereo(note, 0.35 * np.sin(k * 0.7)), t0)
    t0 += step
    k += 1
arp = lp(arp, 4500)
music += (
    arp
    * 0.10
    * section_level(
        [
            (S["demo"], 0),
            (S["demo"] + 3, 0.6),
            (S["data"], 1.0),
            (S["failure"], 1.0),
            (S["failure"] + 1, 0.45),
            (S["eng"], 0.9),
            (S["outro"] + 1, 0),
        ]
    )[:, None]
)

# ---- drums: half-time kick and offbeat hats in the build sections
drums = np.zeros(N)
kl = int(0.4 * SR)
kt = np.arange(kl) / SR
kick = np.sin(2 * np.pi * (45 * kt + (120 - 45) * 0.04 * (1 - np.exp(-kt / 0.04)))) * np.exp(-kt / 0.12)
hl = int(0.04 * SR)
hat = hp(rng.standard_normal(hl), 7000) * np.exp(-np.arange(hl) / SR / 0.012)


def grid(a: float, b: float, every: float, offset: float = 0.0) -> list[float]:
    first = np.ceil((a - offset) / every) * every + offset
    return list(np.arange(first, b, every))


for a, b in [(S["data"], S["failure"]), (S["eng"], S["outro"] + 0.2)]:
    for tk in grid(a, b, 2 * BEAT):
        put(drums, kick * 0.9, tk)
    for th in grid(a + BAR, b, BEAT, BEAT / 2):
        put(drums, hat * 0.25, th)
music += stereo(drums * 0.55)

# ---- riser into the results, hit on the first result frame
rl = int(2.2 * SR)
rt = np.arange(rl) / SR
noise = rng.standard_normal(rl)
riser = np.zeros(rl)
for i in range(0, rl, 2048):  # sweep a band-pass upwards
    f = 300 + (6000 - 300) * (i / rl) ** 2
    riser[i : i + 2048] = bp(noise[max(0, i - 4096) : i + 2048], f * 0.7, min(f * 1.4, 18000))[
        -len(riser[i : i + 2048]) :
    ]
riser *= (rt / rt[-1]) ** 2 * 0.35
put(music, stereo(riser), S["eval"] - 2.2)

# ---- reverb on the whole bed (synthetic stereo IR)
irl = int(2.8 * SR)
it = np.arange(irl) / SR
ir = np.stack([rng.standard_normal(irl), rng.standard_normal(irl)], 1) * np.exp(-it / 0.7)[:, None]
ir = lp(ir, 6000) * 0.02
wet = np.stack([fftconvolve(music[:, c], ir[:, c])[:N] for c in range(2)], 1)
music = music + wet * 0.6

# ================================================================================ sound effects
sfx = np.zeros((N, 2))


def whoosh(dur: float = 0.55, lo: float = 400, hi: float = 4000, gain: float = 0.18) -> np.ndarray:
    n = int(dur * SR)
    x = rng.standard_normal(n)
    y = np.zeros(n)
    for i in range(0, n, 1024):
        p = i / n
        f = lo + (hi - lo) * np.sin(np.pi * p)
        y[i : i + 1024] = bp(x[max(0, i - 2048) : i + 1024], f * 0.6, min(f * 1.6, 18000))[
            -len(y[i : i + 1024]) :
        ]
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return y * e * gain


def boom(gain: float = 0.6) -> np.ndarray:
    n = int(1.6 * SR)
    tt = np.arange(n) / SR
    body = np.sin(2 * np.pi * (38 * tt + 60 * 0.08 * (1 - np.exp(-tt / 0.08)))) * np.exp(-tt / 0.45)
    air = lp(rng.standard_normal(n), 1200) * np.exp(-tt / 0.15) * 0.25
    return (body + air) * gain


def tick(f: float = 2400, gain: float = 0.12) -> np.ndarray:
    n = int(0.06 * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.012) * gain


def shimmer(dur: float, gain: float = 0.05) -> np.ndarray:
    n = int(dur * SR)
    y = np.zeros(n)
    for _ in range(70):  # glints as the 543 points fly in
        at_i = int(rng.random() ** 0.8 * (n - 0.3 * SR))
        f = hz(rng.choice([81, 84, 88, 93, 96, 100]))
        ln = int(0.25 * SR)
        tt = np.arange(ln) / SR
        y[at_i : at_i + ln] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.06) * rng.uniform(0.3, 1)
    return y * gain


put(sfx, stereo(shimmer(2.4)), 0.15)
for k, _ in SCENES[1:]:
    w = whoosh()
    put(sfx, np.stack([w, np.roll(w, 300)], 1), S[k] - 0.15)
put(sfx, stereo(boom(0.55)), S["eval"])
put(sfx, stereo(boom(0.35)), S["outro"] + 8 / FPS)
# eval bars land (Results.tsx: bars start at 45 + i*22 frames, grow over 45 frames)
for i in range(3):
    put(sfx, stereo(tick(1800 + 400 * i, 0.14)), S["eval"] + (45 + i * 22 + 40) / FPS)
# engineering cards pop in (20 + i*5 frames)
for i in range(6):
    put(sfx, stereo(tick(3000, 0.06), (i % 3 - 1) * 0.5), S["eng"] + (20 + i * 5) / FPS)
# data scene: 21 signers pop in (45 + i*1.5 frames), the 4 held-out ones lift (95 frames)
for i in range(21):
    put(sfx, stereo(tick(2600 + 30 * i, 0.03), (i - 10) / 12), S["data"] + (45 + i * 1.5) / FPS)
put(sfx, stereo(whoosh(0.5, 900, 3500, 0.10)), S["data"] + 95 / FPS)
# mirroring flip
put(sfx, stereo(whoosh(0.9, 300, 2500, 0.16)), S["mirror"] + 62 / FPS)


def master(x: np.ndarray, peak_db: float) -> np.ndarray:
    x = hp(x, 28)
    x = np.tanh(x * 1.2) / np.tanh(1.2)
    return x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)


def write(x: np.ndarray, name: str) -> None:
    wav = PUB / f"{name}.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-b:a", "320k", str(PUB / f"{name}.mp3")],
        check=True,
    )
    wav.unlink()
    print("wrote", PUB / f"{name}.mp3")


music = music[: int(TOTAL * SR)]
sfx = sfx[: int(TOTAL * SR)]
write(master(music, -1.0), "music")
write(master(sfx, -3.0), "sfx")
print(f"timeline {TOTAL:.2f} s; eval at {S['eval']:.2f} s, outro at {S['outro']:.2f} s")
