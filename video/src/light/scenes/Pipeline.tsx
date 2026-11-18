import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { OFF, clip } from "../../data";
import { Skeleton } from "../../Skeleton";
import { C, FONT, SHADOW } from "../../kit/theme";
import { Chip, Counter, Eyebrow, FadeUp, Panel, Scene, Words, clamp, enter, progress, useLayout } from "../../kit/ui";
import { L, sci } from "../num";
import { Copy, Em, Legend, SK, Split } from "../parts";

// ---------------------------------------------------------------------------------- 4a. data
export const Data: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { u, wide } = useLayout();
  // positions of the held-out signers in the row of people (spread out, purely illustrative)
  const held = Array.from({ length: L.heldOutSigners }, (_, i) => Math.round(((i + 0.5) * L.signers) / L.heldOutSigners));
  const split = progress(f, 92, 120);
  const stats = [
    { v: L.videos, l: "videos" },
    { v: L.signers, l: "signers" },
    { v: L.signs, l: "signs" },
  ];
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: (wide ? 56 : 44) * u, padding: 60 * u }}>
        <Eyebrow size={19 * u}>01 · The data</Eyebrow>
        <div style={{ display: "flex", gap: (wide ? 40 : 18) * u }}>
          {stats.map((s, i) => (
            <FadeUp key={s.l} at={6 + i * 4}>
              <Panel style={{ padding: `${(wide ? 30 : 22) * u}px ${(wide ? 48 : 22) * u}px`, display: "flex", flexDirection: "column", alignItems: "center", minWidth: (wide ? 300 : 0) * u }}>
                <div style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: (wide ? 120 : 76) * u, color: C.ink, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  <Counter to={s.v} at={6 + i * 4} dur={45} />
                </div>
                <div style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 20 * u, color: C.muted, marginTop: 12 * u, textTransform: "uppercase", letterSpacing: "0.18em" }}>{s.l}</div>
              </Panel>
            </FadeUp>
          ))}
        </div>
        <div style={{ display: "flex", gap: (wide ? 22 : 9) * u, marginTop: 10 * u }}>
          {Array.from({ length: L.signers }).map((_, i) => {
            const s = enter(f, 40 + i * 1.5, 20);
            const isHeld = held.includes(i);
            const color = isHeld && split > 0.5 ? C.gold : C.ink;
            return (
              <div key={i} style={{ transform: `translateY(${(1 - s) * 16 * u + (isHeld ? split * -16 * u : 0)}px)`, opacity: s * (isHeld ? 1 : 1 - split * 0.6), display: "flex", flexDirection: "column", alignItems: "center", gap: 4 * u }}>
                <div style={{ width: (wide ? 28 : 21) * u, height: (wide ? 28 : 21) * u, borderRadius: 99, background: color }} />
                <div style={{ width: (wide ? 48 : 34) * u, height: (wide ? 22 : 17) * u, borderRadius: `${30 * u}px ${30 * u}px 0 0`, background: color, opacity: isHeld && split > 0.5 ? 1 : 0.75 }} />
              </div>
            );
          })}
        </div>
        <FadeUp at={108}>
          <div style={{ fontFamily: FONT.body, fontSize: (wide ? 32 : 28) * u, color: C.muted, textAlign: "center", maxWidth: 1300 * u, lineHeight: 1.4 }}>
            <Em>{`${L.heldOutSigners} signers are held out:`}</Em> the model never sees them in training.
          </div>
        </FadeUp>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 4b. 543 -> 89
export const Points: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { u, wide } = useLayout();
  const sel = progress(f, 40, 80);
  return (
    <Scene dur={dur}>
      <Split
        step="02 · What it keeps"
        title={`${L.rawPoints} points in. ${L.keptPoints} kept.`}
        highlight={["kept."]}
        vhSquare={0.42}
        visual={(w, h) => <Skeleton clip={clip("water")} t={f * 0.5} width={w} height={h} selected={sel} trails id="pts" palette={SK} />}
      >
        <div style={{ fontFamily: FONT.head, fontSize: (wide ? 104 : 72) * u, fontWeight: 700, color: C.ink, lineHeight: 1, letterSpacing: "-0.04em" }}>
          <Counter from={L.rawPoints} to={L.keptPoints} at={40} dur={40} />
          <span style={{ fontFamily: FONT.body, fontSize: (wide ? 30 : 24) * u, color: C.muted, fontWeight: 500, letterSpacing: 0 }}> points / frame</span>
        </div>
        <Copy at={56}>{`Nose, ${L.lipPoints} lip points, both hands, and shoulders to wrists. Only x and y.`}</Copy>
        {wide && <Copy at={72}>The rest of the face mesh is noise for this task.</Copy>}
      </Split>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 4c. mirroring
export const Mirror: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { u, wide } = useLayout();
  const m = progress(f, 62, 100);
  const lefty = clip("lefty");
  return (
    <Scene dur={dur}>
      <Split
        step="03 · Left-handed signers"
        title="Mirror the lefties."
        highlight={["lefties."]}
        vhSquare={0.42}
        visual={(w, h) => (
          <>
            <Skeleton clip={lefty} t={f * (lefty.frames / 110)} width={w} height={h} mirror={m} trails id="mir" palette={SK} />
            <div style={{ position: "absolute", top: h * 0.08, bottom: h * 0.08, left: w / 2 - 1, width: 2, background: C.gold, opacity: interpolate(f, [55, 65, 100, 110], [0, 0.8, 0.8, 0], clamp) }} />
          </>
        )}
      >
        <Copy at={18}>
          Only about <Em>{`${L.leftShare}%`}</Em> of videos are left-hand dominant: too few to learn from.
        </Copy>
        <Copy at={66}>
          So the sequence is flipped, and every signer looks <Em>right-handed</Em>.
        </Copy>
        {wide && (
          <FadeUp at={96}>
            <div style={{ fontFamily: FONT.mono, fontSize: 18 * u, color: C.muted }}>test: a mirrored signer gets identical features</div>
          </FadeUp>
        )}
        <div style={{ marginTop: (wide ? 6 : 0) * u }}>
          <Legend at={wide ? 104 : 90} size={(wide ? 16 : 14) * u} />
        </div>
      </Split>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 4d. features
const ROWS = 40;
const useFeatureGrid = (cols: number) =>
  useMemo(() => {
    // Real values from a held-out clip: the dominant hand's 20 joints (x, y) resampled to 64 frames,
    // gaps filled from the nearest frame where the hand was seen, normalised per row (as in the dark cut).
    const cands = ["demo2", "demo3", "demo4"].map(clip);
    const cover = (c: ReturnType<typeof clip>) => {
      const off = c.handedness === "left" ? OFF.left : OFF.right;
      return c.landmarks.filter((fr) => fr[off]).length / c.frames;
    };
    const c = cands.sort((x, y) => cover(y) - cover(x))[0];
    const off = c.handedness === "left" ? OFF.left : OFF.right;
    const seen = c.landmarks.map((fr, i) => (fr[off] ? i : -1)).filter((i) => i >= 0);
    const near = (i: number) => seen.reduce((best, j) => (Math.abs(j - i) < Math.abs(best - i) ? j : best), seen[0]);
    const grid: number[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const pi = off + 1 + Math.floor(r / 2);
      const axis = r % 2;
      const row: number[] = [];
      for (let k = 0; k < cols; k++) {
        const fr = c.landmarks[near(Math.floor((k / cols) * c.frames))];
        const p = fr[pi];
        row.push(p ? p[axis] : NaN);
      }
      const vals = row.filter((v) => !Number.isNaN(v));
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      grid.push(row.map((v) => (Number.isNaN(v) ? -1 : (v - lo) / (hi - lo + 1e-6))));
    }
    return grid;
  }, [cols]);

// blue (#7EA4FF) for low values -> navy (#0C1733) for high
const heat = (v: number) => {
  const r = Math.round(126 + (12 - 126) * v);
  const g = Math.round(164 + (23 - 164) * v);
  const b = Math.round(255 + (51 - 255) * v);
  return `rgba(${r},${g},${b},${0.22 + 0.78 * v})`;
};

export const Features: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { u, wide } = useLayout();
  const COLS = L.maxLen;
  const grid = useFeatureGrid(COLS);
  const reveal = interpolate(f, [10, 70], [0, COLS + 8], clamp);
  return (
    <Scene dur={dur}>
      <Split
        step="04 · Features"
        title="Every sign becomes a matrix."
        highlight={["matrix."]}
        vhSquare={0.44}
        visual={(w, h) => {
          const inner = Math.min(w - 48 * u, (h - 90 * u) / 0.75); // grid height = 0.75 x width
          const cw = inner / COLS;
          const ch = (cw * COLS * 0.75) / ROWS;
          return (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Panel style={{ padding: 22 * u }}>
                <svg width={cw * COLS} height={ch * ROWS} style={{ display: "block" }}>
                  {grid.map((row, r) =>
                    row.map((v, k) => {
                      if (k > reveal) return null;
                      const fresh = Math.max(0, 1 - (reveal - k) / 6);
                      const col = v < 0 ? "rgba(12,23,51,0.04)" : heat(v);
                      return <rect key={`${r}-${k}`} x={k * cw + 0.5} y={r * ch + 0.5} width={cw - 1} height={ch - 1} rx={1.2} fill={fresh > 0.2 ? C.gold : col} opacity={fresh > 0.2 ? 0.4 + 0.6 * fresh : 1} />;
                    }),
                  )}
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT.mono, fontSize: 15 * u, color: C.muted, marginTop: 12 * u, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  <span>frame 1</span>
                  <span>time →</span>
                  <span>{`frame ${COLS}`}</span>
                </div>
              </Panel>
            </div>
          );
        }}
      >
        <div style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: (wide ? 76 : 56) * u, color: C.ink, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
          <Counter to={L.features} at={14} dur={36} /> <span style={{ color: C.muted, fontWeight: 600 }}>×</span> {L.maxLen}
        </div>
        <Copy at={30}>{`${L.features} features per frame: positions, velocities, and the hand's shape relative to its wrist.`}</Copy>
        {wide && <Copy at={48}>{`At most ${L.maxLen} evenly spaced frames, centred and scaled per sequence.`}</Copy>}
      </Split>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 4e. model
const BLOCKS = [
  { t: "Input", s: `${L.maxLen} × ${L.features}`, c: C.series[4] },
  { t: `Conv1D ×${L.convs}`, s: `kernel ${L.kernel}`, c: C.blue },
  { t: "Transformer", s: `${L.heads} heads`, c: C.gold },
  { t: `Conv1D ×${L.convs}`, s: "depthwise", c: C.blue },
  { t: "Transformer", s: `width ${L.dim}`, c: C.gold },
  { t: "Pool", s: "masked mean", c: C.green },
  { t: `${L.signs} signs`, s: "softmax", c: C.ink },
];

export const Model: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { width, u, wide } = useLayout();
  const bw = wide ? 200 * u : 136 * u;
  const gap = wide ? 30 * u : 10 * u;
  const total = BLOCKS.length * bw + (BLOCKS.length - 1) * gap;
  const pulse = ((f - 40) % 50) / 50;
  const fit = Math.min(1, (width - 50 * u) / total);
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: (wide ? 56 : 44) * u, padding: 50 * u }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * u }}>
          <Eyebrow size={19 * u}>05 · The model</Eyebrow>
          <Words text="Conv1D for motion. Transformer for context." at={4} size={(wide ? 72 : 56) * u} highlight={["context."]} maxWidth={width - 100 * u} />
        </div>
        <div style={{ position: "relative", width: total, display: "flex", gap, transform: `scale(${fit})` }}>
          {f > 40 && <div style={{ position: "absolute", top: "50%", left: pulse * (total - 120 * u), width: 120 * u, height: 4 * u, marginTop: -2 * u, background: `linear-gradient(90deg, transparent, ${C.gold})`, borderRadius: 4, zIndex: 0 }} />}
          {BLOCKS.map((b, i) => {
            const s = enter(f, 12 + i * 3);
            const lit = f > 40 && Math.abs(pulse * (total - 120 * u) + 60 * u - (i * (bw + gap) + bw / 2)) < bw * 0.6;
            return (
              <div key={i} style={{ width: bw, transform: `translateY(${(1 - s) * 34}px)`, opacity: s, zIndex: 1 }}>
                <Panel style={{ padding: `${(wide ? 24 : 16) * u}px ${10 * u}px`, textAlign: "center", borderColor: lit ? C.gold : C.line, boxShadow: lit ? SHADOW.goldGlow : SHADOW.card, overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 6 * u, background: b.c }} />
                  <div style={{ fontFamily: FONT.head, fontWeight: 600, fontSize: (wide ? 27 : 19) * u, color: C.ink, letterSpacing: "-0.02em", marginTop: 4 * u, whiteSpace: "nowrap" }}>{b.t}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: (wide ? 16 : 13) * u, color: C.muted, marginTop: 8 * u, whiteSpace: "nowrap" }}>{b.s}</div>
                </Panel>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 14 * u, flexWrap: "wrap", justifyContent: "center", maxWidth: width - 80 * u }}>
          <Chip at={56} size={(wide ? 21 : 19) * u} tone="gold">{`${(L.params / 1e6).toFixed(1)}M parameters`}</Chip>
          <Chip at={62} size={(wide ? 21 : 19) * u}>{`${L.sizeMb.toFixed(1)} MB`}</Chip>
          <Chip at={68} size={(wide ? 21 : 19) * u}>{`${Math.round(L.minutes)} min on a ${L.device}`}</Chip>
          <Chip at={74} size={(wide ? 21 : 19) * u}>tracked in MLflow</Chip>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 4f. one ONNX file
export const Onnx: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { width, height, u, wide } = useLayout();
  const cx = width / 2;
  const cy = height * (wide ? 0.49 : 0.47);
  const targets = [
    { t: "Training", s: `PyTorch · ${L.device}` },
    { t: "API", s: "FastAPI · ONNX Runtime" },
    { t: "Browser", s: "ONNX Runtime Web" },
  ];
  const spread = wide ? 520 * u : 330 * u;
  const ty = cy + (wide ? 230 : 220) * u;
  const draw = progress(f, 36, 70);
  const s0 = enter(f, 14);
  return (
    <Scene dur={dur}>
      <AbsoluteFill>
        <div style={{ position: "absolute", top: (wide ? 90 : 70) * u, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * u, padding: `0 ${50 * u}px`, boxSizing: "border-box" }}>
          <Eyebrow size={19 * u}>06 · One file</Eyebrow>
          <Words text="Preprocessing lives inside the model." at={4} size={(wide ? 72 : 56) * u} highlight={["inside"]} maxWidth={width - 100 * u} />
        </div>
        <svg width={width} height={height} style={{ position: "absolute" }}>
          {targets.map((_, i) => {
            const x = cx + (i - 1) * spread;
            const len = Math.hypot(x - cx, ty - 50 * u - (cy + 70 * u));
            return <line key={i} x1={cx} y1={cy + 70 * u} x2={x} y2={ty - 50 * u} stroke={C.ink} strokeWidth={2 * u} strokeOpacity={0.35} strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />;
          })}
        </svg>
        <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%,-50%) translateY(${(1 - s0) * 24}px)`, opacity: s0 }}>
          <Panel float style={{ padding: `${28 * u}px ${50 * u}px`, border: `1.5px solid ${C.gold}`, textAlign: "center" }}>
            <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: (wide ? 46 : 40) * u, color: C.ink }}>model.onnx</div>
            <div style={{ fontFamily: FONT.mono, fontSize: (wide ? 18 : 15) * u, color: C.muted, marginTop: 8 * u, whiteSpace: "nowrap" }}>select · mirror · normalise · resample · classify</div>
          </Panel>
        </div>
        {targets.map((tg, i) => {
          const s = enter(f, 56 + i * 4);
          return (
            <div key={tg.t} style={{ position: "absolute", left: cx + (i - 1) * spread, top: ty, transform: `translate(-50%,-50%) translateY(${(1 - s) * 20}px)`, opacity: s, textAlign: "center" }}>
              <Panel style={{ padding: `${18 * u}px ${24 * u}px`, minWidth: (wide ? 300 : 230) * u, boxSizing: "border-box" }}>
                <div style={{ fontFamily: FONT.head, fontWeight: 600, fontSize: (wide ? 34 : 28) * u, color: C.ink, letterSpacing: "-0.02em" }}>{tg.t}</div>
                <div style={{ fontFamily: FONT.mono, fontSize: (wide ? 16 : 14) * u, color: C.muted, marginTop: 6 * u, whiteSpace: "nowrap" }}>{tg.s}</div>
              </Panel>
            </div>
          );
        })}
        <div style={{ position: "absolute", bottom: (wide ? 56 : 60) * u, width: "100%", display: "flex", justifyContent: "center" }}>
          <FadeUp at={84}>
            <div style={{ fontFamily: FONT.body, fontSize: (wide ? 30 : 27) * u, color: C.muted, textAlign: "center", padding: `0 ${40 * u}px`, lineHeight: 1.45 }}>
              Same code everywhere, so they <Em>can't drift</Em>.{wide ? " " : <br />}
              <span style={{ fontFamily: FONT.mono, fontSize: (wide ? 20 : 18) * u, whiteSpace: "nowrap" }}>{`max gap to PyTorch: ${sci(L.parity)[0]} × 10`}<sup style={{ fontSize: "0.7em" }}>{sci(L.parity)[1]}</sup></span>
            </div>
          </FadeUp>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
