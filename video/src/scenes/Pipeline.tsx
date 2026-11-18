import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { NUM, OFF, clip } from "../data";
import { Skeleton } from "../Skeleton";
import { C, FONT } from "../theme";
import { Chip, Counter, Eyebrow, FadeUp, Panel, Scene, Words, clamp, progress, useLayout } from "../ui";

/** Shared layout: visual on one side, copy on the other (stacked on square/vertical). */
const Split: React.FC<{ step: string; title: string; visual: (w: number, h: number) => React.ReactNode; children?: React.ReactNode; highlight?: string[] }> = ({
  step,
  title,
  visual,
  children,
  highlight,
}) => {
  const { width, height, u, wide } = useLayout();
  const vw = wide ? width * 0.5 : width - 120 * u;
  const vh = wide ? height * 0.82 : height * 0.5;
  return (
    <AbsoluteFill style={{ flexDirection: wide ? "row" : "column", alignItems: "center", justifyContent: "center", gap: (wide ? 40 : 20) * u, padding: (wide ? 80 : 50) * u }}>
      {!wide && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 * u, alignItems: "center", width: "100%" }}>
          <Eyebrow size={18 * u}>{step}</Eyebrow>
          <Words text={title} at={4} size={54 * u} weight={800} highlight={highlight} />
        </div>
      )}
      <div style={{ width: vw, height: vh, position: "relative", flexShrink: 0 }}>{visual(vw, vh)}</div>
      <div style={{ flex: wide ? 1 : undefined, display: "flex", flexDirection: "column", gap: 26 * u, alignItems: wide ? "flex-start" : "center", maxWidth: wide ? 720 * u : undefined }}>
        {wide && (
          <>
            <Eyebrow size={20 * u}>{step}</Eyebrow>
            <Words text={title} at={4} size={72 * u} weight={800} align="left" highlight={highlight} />
          </>
        )}
        {children}
      </div>
    </AbsoluteFill>
  );
};

const Body: React.FC<{ at: number; children: React.ReactNode; color?: string }> = ({ at, children, color = C.muted }) => {
  const { u, wide } = useLayout();
  return (
    <FadeUp at={at}>
      <div style={{ fontFamily: FONT.body, fontSize: (wide ? 32 : 28) * u, lineHeight: 1.45, color, textAlign: wide ? "left" : "center" }}>{children}</div>
    </FadeUp>
  );
};

// ---------------------------------------------------------------------------------- 4a. data
export const Data: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, wide } = useLayout();
  const held = [3, 8, 13, 18]; // positions of the 4 held-out signers in the row
  const split = progress(f, 95, 125);
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60 * u, padding: 60 * u }}>
        <Eyebrow size={20 * u}>01 · The data</Eyebrow>
        <div style={{ display: "flex", gap: (wide ? 110 : 50) * u, alignItems: "flex-end" }}>
          {[
            { v: NUM.videos, l: "videos" },
            { v: 21, l: "signers" },
            { v: 250, l: "signs" },
          ].map((s, i) => (
            <FadeUp key={s.l} at={6 + i * 6}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: (wide ? 140 : 92) * u, color: C.ink, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  <Counter to={s.v} at={6 + i * 6} dur={50} />
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 24 * u, color: C.muted, marginTop: 10 * u }}>{s.l}</div>
              </div>
            </FadeUp>
          ))}
        </div>
        <div style={{ display: "flex", gap: (wide ? 22 : 10) * u, marginTop: 20 * u }}>
          {Array.from({ length: 21 }).map((_, i) => {
            const s = spring({ frame: f - 45 - i * 1.5, fps, config: { damping: 14 } });
            const isHeld = held.includes(i);
            const col = isHeld ? interpolate(split, [0, 1], [0, 1]) : 0;
            const color = col > 0.5 ? C.warm : C.ink;
            return (
              <div key={i} style={{ transform: `scale(${s}) translateY(${isHeld ? split * -18 * u : 0}px)`, opacity: isHeld ? 1 : 1 - split * 0.55, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 * u }}>
                <div style={{ width: (wide ? 30 : 22) * u, height: (wide ? 30 : 22) * u, borderRadius: 99, background: color, boxShadow: col > 0.5 ? `0 0 20px ${C.warm}` : undefined }} />
                <div style={{ width: (wide ? 50 : 36) * u, height: (wide ? 24 : 18) * u, borderRadius: `${30 * u}px ${30 * u}px 0 0`, background: color, opacity: 0.6 }} />
              </div>
            );
          })}
        </div>
        <FadeUp at={110}>
          <div style={{ fontFamily: FONT.body, fontSize: 32 * u, color: C.muted, textAlign: "center" }}>
            <span style={{ color: C.warm, fontWeight: 600 }}>4 signers are held out</span> — the model never sees them in training.
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
  const sel = progress(f, 45, 85);
  return (
    <Scene dur={dur}>
      <Split
        step="02 · What it keeps"
        title="543 points in. 89 kept."
        highlight={["89"]}
        visual={(w, h) => <Skeleton clip={clip("water")} t={f * 0.5} width={w} height={h} selected={sel} trails id="pts" />}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 96 * u, fontWeight: 700, color: C.accent, lineHeight: 1 }}>
          <Counter from={543} to={89} at={45} dur={40} />
          <span style={{ fontSize: 30 * u, color: C.muted, fontWeight: 400 }}> points / frame</span>
        </div>
        <Body at={60}>Nose, 40 lip points, both hands, and shoulders to wrists. Only x and y.</Body>
        <Body at={75} color={C.dim}>
          {wide ? "The rest of the face mesh is noise for this task." : ""}
        </Body>
      </Split>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 4c. mirroring
export const Mirror: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { u } = useLayout();
  const m = progress(f, 62, 100);
  const lefty = clip("lefty");
  return (
    <Scene dur={dur}>
      <Split
        step="03 · Left-handed signers"
        title="Mirror the lefties."
        highlight={["lefties."]}
        visual={(w, h) => (
          <>
            <Skeleton clip={lefty} t={f * (lefty.frames / 110)} width={w} height={h} mirror={m} trails id="mir" />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: w / 2, width: 2, background: `linear-gradient(transparent, ${C.line}, transparent)`, opacity: interpolate(f, [55, 65, 100, 110], [0, 1, 1, 0], clamp) }} />
          </>
        )}
      >
        <Body at={18}>
          Only about <span style={{ color: C.warm, fontWeight: 600 }}>3%</span> of videos are left-hand dominant — too few to learn from.
        </Body>
        <Body at={70}>
          So the sequence is flipped, and every signer looks <span style={{ color: C.accent, fontWeight: 600 }}>right-handed</span>.
        </Body>
        <FadeUp at={100}>
          <div style={{ fontFamily: FONT.mono, fontSize: 20 * u, color: C.dim }}>test: a mirrored signer gets identical features</div>
        </FadeUp>
      </Split>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 4d. features
const COLS = 64;
const ROWS = 40;
const useFeatureGrid = () =>
  useMemo(() => {
    // Real values from a held-out clip: the dominant hand's 20 joints (x, y) resampled to 64 frames,
    // gaps filled from the nearest frame where the hand was seen, normalised per row.
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
      for (let k = 0; k < COLS; k++) {
        const fr = c.landmarks[near(Math.floor((k / COLS) * c.frames))];
        const p = fr[pi];
        row.push(p ? p[axis] : NaN);
      }
      const vals = row.filter((v) => !Number.isNaN(v));
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      grid.push(row.map((v) => (Number.isNaN(v) ? -1 : (v - lo) / (hi - lo + 1e-6))));
    }
    return grid;
  }, []);

export const Features: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { u } = useLayout();
  const grid = useFeatureGrid();
  const reveal = interpolate(f, [10, 70], [0, COLS + 8], clamp);
  return (
    <Scene dur={dur}>
      <Split
        step="04 · Features"
        title="Every sign becomes a matrix."
        highlight={["matrix."]}
        visual={(w, h) => {
          const cw = w / COLS;
          const ch = Math.min(h * 0.8, w * 0.75) / ROWS;
          return (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Panel style={{ padding: 22 * u }}>
                <svg width={cw * COLS} height={ch * ROWS}>
                  {grid.map((row, r) =>
                    row.map((v, k) => {
                      if (k > reveal) return null;
                      const fresh = Math.max(0, 1 - (reveal - k) / 6);
                      const col = v < 0 ? "rgba(255,255,255,0.03)" : `rgba(${Math.round(94 + (255 - 94) * v * 0.3)},${Math.round(120 + 80 * v)},255,${0.12 + 0.88 * v})`;
                      return <rect key={`${r}-${k}`} x={k * cw + 0.6} y={r * ch + 0.6} width={cw - 1.2} height={ch - 1.2} rx={1.5} fill={fresh > 0.2 ? C.ink : col} opacity={fresh > 0.2 ? fresh : 1} />;
                    }),
                  )}
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT.mono, fontSize: 16 * u, color: C.dim, marginTop: 12 * u }}>
                  <span>frame 1</span>
                  <span>time →</span>
                  <span>frame 64</span>
                </div>
              </Panel>
            </div>
          );
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 64 * u, color: C.ink, lineHeight: 1.1 }}>
          <Counter to={398} at={14} dur={40} /> <span style={{ color: C.muted, fontWeight: 400 }}>×</span> <span style={{ color: C.accent }}>64</span>
        </div>
        <Body at={30}>398 features per frame: positions, velocities, and the hand's shape relative to its wrist.</Body>
        <Body at={50}>At most 64 evenly spaced frames, centred and scaled per sequence.</Body>
      </Split>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 4e. model
const BLOCKS = [
  { t: "Input", s: "64 × 398", c: C.muted },
  { t: "Conv1D ×3", s: "kernel 17", c: C.accent },
  { t: "Transformer", s: "4 heads", c: C.warm },
  { t: "Conv1D ×3", s: "depthwise", c: C.accent },
  { t: "Transformer", s: "width 192", c: C.warm },
  { t: "Pool", s: "masked mean", c: C.arm },
  { t: "250 signs", s: "softmax", c: C.ink },
];

export const Model: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, u, wide } = useLayout();
  const bw = wide ? 200 * u : 132 * u;
  const gap = wide ? 34 * u : 12 * u;
  const total = BLOCKS.length * bw + (BLOCKS.length - 1) * gap;
  const pulse = ((f - 40) % 50) / 50;
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 56 * u, padding: 50 * u }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * u }}>
          <Eyebrow size={20 * u}>05 · The model</Eyebrow>
          <Words text="Conv1D for motion. Transformer for context." at={4} size={(wide ? 72 : 54) * u} weight={800} highlight={["Conv1D", "Transformer"]} maxWidth={width - 100 * u} />
        </div>
        <div style={{ position: "relative", width: total, display: "flex", gap, transform: wide ? undefined : `scale(${Math.min(1, (width - 60 * u) / total)})` }}>
          {f > 40 && (
            <div style={{ position: "absolute", top: "50%", left: pulse * total, width: 120 * u, height: 4 * u, marginTop: -2 * u, background: `linear-gradient(90deg, transparent, ${C.accent})`, filter: "blur(1px)", boxShadow: `0 0 20px ${C.accent}`, zIndex: 0 }} />
          )}
          {BLOCKS.map((b, i) => {
            const s = spring({ frame: f - 14 - i * 4, fps, config: { damping: 16 } });
            const lit = f > 40 && Math.abs(pulse * total - (i * (bw + gap) + bw / 2)) < bw * 0.6;
            return (
              <div key={i} style={{ width: bw, transform: `translateY(${(1 - s) * 40}px)`, opacity: s, zIndex: 1 }}>
                <Panel style={{ padding: `${(wide ? 26 : 18) * u}px ${12 * u}px`, textAlign: "center", borderColor: lit ? b.c : C.line, boxShadow: lit ? `0 0 40px ${b.c}55` : undefined, background: "rgba(10,14,20,0.92)" }}>
                  <div style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: (wide ? 28 : 20) * u, color: b.c }}>{b.t}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: (wide ? 17 : 13) * u, color: C.dim, marginTop: 8 * u }}>{b.s}</div>
                </Panel>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16 * u, flexWrap: "wrap", justifyContent: "center" }}>
          <Chip at={60} size={22 * u} color={C.accent}>{(NUM.params / 1e6).toFixed(1)}M parameters</Chip>
          <Chip at={66} size={22 * u}>8.5 MB</Chip>
          <Chip at={72} size={22 * u}>{Math.round(NUM.minutes)} min on a {NUM.device}</Chip>
          <Chip at={78} size={22 * u}>tracked in MLflow</Chip>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 4f. one ONNX file
export const Onnx: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, height, u, wide } = useLayout();
  const cx = width / 2;
  const cy = height * (wide ? 0.5 : 0.48);
  const targets = [
    { t: "Training", s: "PyTorch · Kaggle T4" },
    { t: "API", s: "FastAPI · ONNX Runtime" },
    { t: "Browser", s: "ONNX Runtime Web" },
  ];
  const spread = wide ? 520 * u : 330 * u;
  const ty = cy + (wide ? 230 : 250) * u;
  const draw = progress(f, 40, 75);
  return (
    <Scene dur={dur}>
      <AbsoluteFill>
        <div style={{ position: "absolute", top: (wide ? 90 : 110) * u, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * u, padding: `0 ${50 * u}px`, boxSizing: "border-box" }}>
          <Eyebrow size={20 * u}>06 · One file</Eyebrow>
          <Words text="Preprocessing lives inside the model." at={4} size={(wide ? 72 : 54) * u} weight={800} highlight={["inside"]} maxWidth={width - 100 * u} />
        </div>
        <svg width={width} height={height} style={{ position: "absolute" }}>
          {targets.map((_, i) => {
            const x = cx + (i - 1) * spread;
            const len = Math.hypot(x - cx, ty - cy - 90 * u);
            return (
              <line key={i} x1={cx} y1={cy + 70 * u} x2={x} y2={ty - 50 * u} stroke={C.accent} strokeWidth={2 * u} strokeOpacity={0.6} strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
            );
          })}
        </svg>
        {(() => {
          const s = spring({ frame: f - 16, fps, config: { damping: 14 } });
          return (
            <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%,-50%) scale(${s})` }}>
              <Panel style={{ padding: `${30 * u}px ${54 * u}px`, borderColor: C.accent, boxShadow: `0 0 80px rgba(94,200,255,0.25)`, background: "rgba(8,14,22,0.95)", textAlign: "center" }}>
                <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 46 * u, color: C.ink }}>model.onnx</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 18 * u, color: C.muted, marginTop: 8 * u }}>select · mirror · normalise · resample · classify</div>
              </Panel>
            </div>
          );
        })()}
        {targets.map((tg, i) => {
          const s = spring({ frame: f - 60 - i * 6, fps, config: { damping: 16 } });
          return (
            <div key={tg.t} style={{ position: "absolute", left: cx + (i - 1) * spread, top: ty, transform: `translate(-50%,-50%) scale(${s})`, textAlign: "center" }}>
              <Panel style={{ padding: `${20 * u}px ${28 * u}px`, minWidth: (wide ? 300 : 230) * u }}>
                <div style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: (wide ? 34 : 28) * u, color: C.ink }}>{tg.t}</div>
                <div style={{ fontFamily: FONT.mono, fontSize: (wide ? 17 : 14) * u, color: C.muted, marginTop: 6 * u }}>{tg.s}</div>
              </Panel>
            </div>
          );
        })}
        <div style={{ position: "absolute", bottom: (wide ? 50 : 90) * u, width: "100%", display: "flex", justifyContent: "center" }}>
          <FadeUp at={88}>
            <div style={{ fontFamily: FONT.body, fontSize: 30 * u, color: C.muted, textAlign: "center", padding: `0 ${40 * u}px` }}>
              Same code everywhere, so they <span style={{ color: C.accent, fontWeight: 600 }}>can't drift</span>.{wide ? " " : <br />}
              <span style={{ fontFamily: FONT.mono, fontSize: 22 * u, color: C.dim, whiteSpace: "nowrap" }}>matches PyTorch to 4 × 10⁻⁷</span>
            </div>
          </FadeUp>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
