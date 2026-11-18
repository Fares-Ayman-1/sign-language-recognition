import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { NUM, clip } from "../data";
import { Skeleton } from "../Skeleton";
import { C, FONT } from "../theme";
import { Chip, Eyebrow, FadeUp, Panel, Scene, Top5, Words, clamp, ease, useLayout } from "../ui";

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

// ---------------------------------------------------------------------------------- 5. evaluation
export const Eval: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, u, wide } = useLayout();
  const rows = [
    { l: "Most frequent sign", v: NUM.majority, t5: null as number | null, c: C.dim },
    { l: "Bag of frames (MLP)", v: NUM.bagTop1, t5: NUM.bagTop5, c: "rgba(255,255,255,0.45)" },
    { l: "Conv1D + Transformer", v: NUM.top1, t5: NUM.top5, c: C.accent },
  ];
  const barW = wide ? 1100 * u : width - 140 * u;
  const gain = Math.round((NUM.top1 - NUM.bagTop1) * 100);
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 50 * u, padding: 60 * u }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * u }}>
          <Eyebrow size={20 * u}>Results · top-1 accuracy over 250 signs</Eyebrow>
          <Words text="Tested on 4 people it has never seen." at={4} size={(wide ? 76 : 56) * u} weight={800} highlight={["never"]} maxWidth={width - 100 * u} />
          <FadeUp at={24}>
            <div style={{ fontFamily: FONT.mono, fontSize: 24 * u, color: C.muted }}>{NUM.heldOut.toLocaleString("en-US")} held-out videos · no checkpoint picked on them</div>
          </FadeUp>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 34 * u, width: barW }}>
          {rows.map((r, i) => {
            const at = 45 + i * 22;
            const g = interpolate(f, [at, at + 45], [0, 1], { ...clamp, easing: ease });
            const s = spring({ frame: f - at, fps, config: { damping: 20 } });
            const hero = i === 2;
            return (
              <div key={r.l} style={{ opacity: s }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 * u }}>
                  <span style={{ fontFamily: hero ? FONT.head : FONT.body, fontWeight: hero ? 700 : 500, fontSize: (hero ? 36 : 28) * u, color: hero ? C.ink : C.muted }}>{r.l}</span>
                  <span style={{ display: "flex", gap: 24 * u, alignItems: "baseline" }}>
                    {r.t5 !== null && <span style={{ fontFamily: FONT.mono, fontSize: 20 * u, color: C.dim }}>top-5 {pct(r.t5 * g)}</span>}
                    <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: (hero ? 54 : 38) * u, color: hero ? C.accent : C.muted }}>{pct(r.v * g)}</span>
                  </span>
                </div>
                <div style={{ height: (hero ? 18 : 12) * u, background: "rgba(255,255,255,0.05)", borderRadius: 20, overflow: "hidden" }}>
                  <div style={{ width: `${r.v * 100 * g}%`, minWidth: r.v > 0 ? 4 : 0, height: "100%", background: r.c, borderRadius: 20, boxShadow: hero ? `0 0 30px ${C.accent}` : undefined }} />
                </div>
              </div>
            );
          })}
        </div>
        <FadeUp at={150}>
          <Panel style={{ padding: `${22 * u}px ${34 * u}px`, display: "flex", gap: 26 * u, alignItems: "center", maxWidth: barW, boxSizing: "border-box" }}>
            <div style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 60 * u, color: C.accent, lineHeight: 1 }}>+{gain}</div>
            <div style={{ fontFamily: FONT.body, fontSize: (wide ? 28 : 24) * u, color: C.muted, lineHeight: 1.4 }}>
              points of top-1 come from the <span style={{ color: C.ink, fontWeight: 600 }}>order of the movements</span>. Averaging frames narrows it to a few candidates; time picks the right one.
            </div>
          </Panel>
        </FadeUp>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 6. failure
export const Failure: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { width, height, u, wide } = useLayout();
  const pairs = [clip("pair_awake"), clip("pair_wake")];
  const cardW = wide ? 640 * u : (width - 130 * u) / 2;
  const skH = wide ? 400 * u : height * 0.33;
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 * u, padding: 50 * u }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * u }}>
          <Eyebrow size={20 * u} color={C.bad}>Where it fails</Eyebrow>
          <Words text="Some signs look almost the same." at={4} size={(wide ? 72 : 54) * u} weight={800} maxWidth={width - 100 * u} />
        </div>
        <div style={{ display: "flex", gap: 30 * u }}>
          {pairs.map((c, i) => (
            <FadeUp key={c.label} at={20 + i * 10}>
              <Panel style={{ width: cardW, padding: 22 * u, boxSizing: "border-box", display: "flex", flexDirection: wide ? "row" : "column", gap: 20 * u, alignItems: "center" }}>
                <div style={{ width: wide ? cardW * 0.46 : cardW - 44 * u, height: skH, background: "#020304", borderRadius: 12 * u, position: "relative", flexShrink: 0 }}>
                  <Skeleton clip={c} t={f * (c.frames / 75)} width={wide ? cardW * 0.46 : cardW - 44 * u} height={skH} trails id={`fail${i}`} pad={0.1} />
                  <div style={{ position: "absolute", left: 12 * u, top: 10 * u, fontFamily: FONT.mono, fontSize: 15 * u, color: C.muted }}>
                    true sign: <span style={{ color: C.ink }}>{c.label}</span>
                  </div>
                </div>
                <div style={{ flex: 1, width: "100%" }}>
                  <Top5 rows={c.top5.slice(0, wide ? 5 : 3)} at={50 + i * 10} width={wide ? cardW * 0.46 : cardW - 44 * u} size={(wide ? 22 : 19) * u} truth={c.label} />
                </div>
              </Panel>
            </FadeUp>
          ))}
        </div>
        <FadeUp at={110}>
          <div style={{ fontFamily: FONT.body, fontSize: (wide ? 30 : 26) * u, color: C.muted, textAlign: "center", maxWidth: 1300 * u, lineHeight: 1.45 }}>
            <span style={{ color: C.ink, fontWeight: 600 }}>awake → wake</span> in 37 of 75 held-out videos. Part of this error is in the labels, not the model —{" "}
            <span style={{ color: C.accent }}>so the demo shows five guesses.</span>
          </div>
        </FadeUp>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 7. engineering
const ENG = [
  { k: "API", t: "FastAPI service", s: "ONNX Runtime, no PyTorch" },
  { k: "BOX", t: "Docker", s: "model mounted read-only" },
  { k: "CI", t: "GitHub Actions", s: "lint · types · tests · build" },
  { k: "EXP", t: "MLflow", s: "every number from a run id" },
  { k: "PSI", t: "Drift monitoring", s: "length · missing parts · confidence" },
  { k: "DOC", t: "Model card", s: "limits stated up front" },
];

export const Engineering: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, u, wide } = useLayout();
  const cols = wide ? 3 : 2;
  const cw = wide ? 440 * u : (width - 150 * u) / 2;
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 50 * u, padding: 50 * u }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * u }}>
          <Eyebrow size={20 * u}>Engineering</Eyebrow>
          <Words text="Shipped like a product, not a notebook." at={4} size={(wide ? 72 : 54) * u} weight={800} highlight={["product,"]} maxWidth={width - 100 * u} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cw}px)`, gap: 24 * u }}>
          {ENG.map((e, i) => {
            const s = spring({ frame: f - 20 - i * 5, fps, config: { damping: 16 } });
            return (
              <div key={e.t} style={{ opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
                <Panel style={{ padding: 28 * u, display: "flex", gap: 22 * u, alignItems: "center" }}>
                  <div style={{ width: 72 * u, height: 72 * u, borderRadius: 16 * u, border: `1px solid ${C.accent}55`, background: "rgba(94,200,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 18 * u, color: C.accent, flexShrink: 0 }}>
                    {e.k}
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: (wide ? 30 : 26) * u, color: C.ink }}>{e.t}</div>
                    <div style={{ fontFamily: FONT.body, fontSize: (wide ? 19 : 17) * u, color: C.muted, marginTop: 4 * u }}>{e.s}</div>
                  </div>
                </Panel>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 8. outro
export const Outro: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { width, height, u, wide } = useLayout();
  const water = clip("water");
  return (
    <Scene dur={dur} outF={30}>
      <AbsoluteFill style={{ alignItems: wide ? "flex-end" : "center", justifyContent: wide ? "center" : "flex-start", paddingRight: wide ? 120 * u : 0, paddingTop: wide ? 0 : 40 * u, opacity: 0.55 }}>
        <Skeleton clip={water} t={f * 0.5} width={wide ? width * 0.42 : width * 0.8} height={wide ? height * 0.85 : height * 0.42} trails id="outro" />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: wide ? "center" : "flex-end", alignItems: wide ? "flex-start" : "center", padding: wide ? `0 ${150 * u}px` : `0 ${50 * u}px ${80 * u}px` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 * u, alignItems: wide ? "flex-start" : "center" }}>
          <Eyebrow size={20 * u}>Sign language recognition · 250 ASL signs</Eyebrow>
          <Words text="Fares Ayman" at={8} size={(wide ? 120 : 92) * u} weight={800} align={wide ? "left" : "center"} />
          <FadeUp at={22}>
            <div style={{ fontFamily: FONT.body, fontSize: 34 * u, color: C.muted }}>AI / ML Engineer · computer vision</div>
          </FadeUp>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 * u, marginTop: 20 * u, alignItems: wide ? "flex-start" : "center" }}>
            <Chip at={40} size={22 * u} color={C.ink}>github.com/Fares-Ayman-1/sign-language-recognition</Chip>
            <Chip at={48} size={22 * u} color={C.muted}>kaggle.com/faresayman1</Chip>
          </div>
          <FadeUp at={70}>
            <div style={{ fontFamily: FONT.body, fontSize: 24 * u, color: C.warm, marginTop: 20 * u }}>A research demo, not an interpreter: single isolated signs from a fixed list.</div>
          </FadeUp>
          <FadeUp at={80}>
            <div style={{ fontFamily: FONT.mono, fontSize: 16 * u, color: C.dim }}>Data: Google Isolated Sign Language Recognition (Kaggle), CC BY 4.0</div>
          </FadeUp>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
