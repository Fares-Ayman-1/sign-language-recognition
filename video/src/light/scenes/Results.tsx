import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clip } from "../../data";
import { Skeleton } from "../../Skeleton";
import { SeriesOutro } from "../../kit/series";
import { C, FONT } from "../../kit/theme";
import { BarList, Callout, Eyebrow, FadeUp, Panel, Scene, Words, enter, useLayout } from "../../kit/ui";
import { L, confusion, pct } from "../num";
import { Em, Key, SK, Top5 } from "../parts";

// ---------------------------------------------------------------------------------- 5. evaluation
export const Eval: React.FC<{ dur: number }> = ({ dur }) => {
  const { width, u, wide } = useLayout();
  const w = wide ? 1100 * u : width - 120 * u;
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: (wide ? 40 : 30) * u, padding: 50 * u }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * u }}>
          <Eyebrow size={(wide ? 19 : 16) * u}>{`Results · top-1 accuracy over ${L.signs} signs`}</Eyebrow>
          <Words text={`Tested on ${L.heldOutSigners} people it has never seen.`} at={4} size={(wide ? 76 : 54) * u} highlight={["never"]} maxWidth={width - 100 * u} />
          <FadeUp at={22}>
            <div style={{ fontFamily: FONT.mono, fontSize: (wide ? 22 : 18) * u, color: C.muted, textAlign: "center" }}>{`${L.heldOut.toLocaleString("en-US")} held-out videos · no checkpoint picked on them`}</div>
          </FadeUp>
        </div>
        <FadeUp at={34}>
          <Panel style={{ padding: `${(wide ? 34 : 26) * u}px ${(wide ? 40 : 30) * u}px`, width: w, boxSizing: "border-box" }}>
            <BarList
              at={44}
              width={w - (wide ? 80 : 60) * u}
              size={(wide ? 27 : 23) * u}
              max={1}
              rows={[
                { label: "Most frequent sign", value: L.majority, display: pct(L.majority) },
                { label: "Bag of frames (MLP)", value: L.bagTop1, display: pct(L.bagTop1), note: `top-5 ${pct(L.bagTop5)}` },
                { label: "Conv1D + Transformer", value: L.top1, display: pct(L.top1), note: `top-5 ${pct(L.top5)}`, hero: true },
              ]}
            />
          </Panel>
        </FadeUp>
        <Callout at={140} big={`+${L.gain}`} width={w}>
          points of top-1 come from the <Em>order of the movements</Em>. Averaging frames narrows it to a few candidates; time picks the right one.
        </Callout>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 6. failure
export const Failure: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { width, height, u, wide } = useLayout();
  const pairs = [clip("pair_awake"), clip("pair_wake")];
  const c = confusion("awake", "wake");
  const cardW = wide ? 640 * u : (width - 120 * u) / 2;
  const skW = wide ? cardW * 0.46 : cardW - 40 * u;
  const skH = wide ? 400 * u : height * 0.27;
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: (wide ? 40 : 26) * u, padding: 44 * u }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * u }}>
          <Eyebrow size={(wide ? 19 : 17) * u}>Where it fails</Eyebrow>
          <Words text="Some signs look almost the same." at={4} size={(wide ? 72 : 52) * u} highlight={["almost"]} maxWidth={width - 100 * u} />
        </div>
        <div style={{ display: "flex", gap: (wide ? 30 : 20) * u }}>
          {pairs.map((p, i) => (
            <FadeUp key={p.label} at={18 + i * 8}>
              <Panel style={{ width: cardW, padding: (wide ? 22 : 20) * u, boxSizing: "border-box", display: "flex", flexDirection: wide ? "row" : "column", gap: (wide ? 22 : 16) * u, alignItems: "center" }}>
                <div style={{ width: skW, height: skH, background: C.card2, border: `1px solid ${C.line}`, borderRadius: 14 * u, position: "relative", flexShrink: 0, overflow: "hidden" }}>
                  <Skeleton clip={p} t={f * (p.frames / 75)} width={skW} height={skH} trails id={`fail${i}`} pad={0.1} palette={SK} />
                  <div style={{ position: "absolute", left: 10 * u, top: 9 * u, fontFamily: FONT.mono, fontSize: 15 * u, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", background: "rgba(251,248,242,0.92)", padding: `${3 * u}px ${6 * u}px`, borderRadius: 6 * u }}>
                    true sign <span style={{ color: C.ink, fontWeight: 700 }}>{p.label}</span>
                  </div>
                </div>
                <div style={{ flex: 1, width: "100%" }}>
                  <Top5 rows={p.top5.slice(0, wide ? 5 : 3)} at={46 + i * 8} width={skW} size={(wide ? 22 : 19) * u} truth={p.label} />
                </div>
              </Panel>
            </FadeUp>
          ))}
        </div>
        <FadeUp at={104}>
          <div style={{ fontFamily: FONT.body, fontSize: (wide ? 30 : 24) * u, color: C.muted, textAlign: "center", maxWidth: 1300 * u, lineHeight: 1.45 }}>
            <Em>{`${c.true} → ${c.pred}`}</Em>{` in ${c.count} of ${c.of} held-out videos. Part of this error is in the labels, not the model, `}
            <Em>so the demo shows five guesses.</Em>
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
  const { width, u, wide } = useLayout();
  const cols = wide ? 3 : 2;
  const cw = wide ? 450 * u : (width - 120 * u) / 2;
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: (wide ? 50 : 36) * u, padding: 50 * u }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * u }}>
          <Eyebrow size={19 * u}>Engineering</Eyebrow>
          <Words text="Shipped like a product, not a notebook." at={4} size={(wide ? 72 : 54) * u} highlight={["product,"]} maxWidth={width - 100 * u} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cw}px)`, gap: (wide ? 22 : 16) * u }}>
          {ENG.map((e, i) => {
            const s = enter(f, 18 + i * 3);
            return (
              <div key={e.t} style={{ opacity: s, transform: `translateY(${(1 - s) * 26}px)` }}>
                <Panel style={{ padding: (wide ? 26 : 20) * u, display: "flex", gap: (wide ? 20 : 16) * u, alignItems: "center" }}>
                  <Key size={(wide ? 17 : 15) * u} min={(wide ? 70 : 60) * u}>{e.k}</Key>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: FONT.head, fontWeight: 600, fontSize: (wide ? 29 : 24) * u, color: C.ink, letterSpacing: "-0.02em" }}>{e.t}</div>
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
  const { width, height, wide, u } = useLayout();
  const visual = wide ? (
    <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "center", paddingRight: 110 * u }}>
      <Skeleton clip={clip("water")} t={f * 0.5} width={width * 0.36} height={height * 0.82} trails id="outro" palette={SK} />
    </AbsoluteFill>
  ) : undefined;
  return (
    <SeriesOutro
      week={1}
      dur={dur}
      repo="github.com/Fares-Ayman-1/sign-language-recognition"
      kaggle="kaggle.com/code/faresayman1/asl-signs-conv1d-transformer-with-onnx-export"
      scope="A research demo, not an interpreter: single isolated signs from a fixed list."
      credit="Data: Google Isolated Sign Language Recognition (Kaggle), CC BY 4.0"
      visual={visual}
    />
  );
};
