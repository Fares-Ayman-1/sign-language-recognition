import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clip } from "../data";
import { Skeleton } from "../Skeleton";
import { C, FONT } from "../theme";
import { Chip, Counter, Eyebrow, FadeUp, Panel, Scene, Top5, Words, clamp, progress, useLayout } from "../ui";

// ---------------------------------------------------------------------------------- 1. hook
export const Hook: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { width, height, u, wide } = useLayout();
  const water = clip("water");
  const asm = progress(f, 4, 75);
  const skH = height * (wide ? 0.86 : 0.5);
  const skW = wide ? width * 0.6 : width;
  return (
    <Scene dur={dur} inF={1}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: wide ? "center" : "flex-start", paddingTop: wide ? 0 : 50 * u }}>
        <div style={{ position: "relative", width: skW, height: skH, transform: wide ? `translateX(${-width * 0.12}px)` : undefined }}>
          <Skeleton clip={water} t={Math.max(0, f - 40) * 0.5} width={skW} height={skH} assemble={asm} trails={asm > 0.95} id="hook" pad={0.06} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: wide ? "center" : "flex-end",
          alignItems: wide ? "flex-end" : "center",
          padding: wide ? `0 ${140 * u}px` : `0 ${60 * u}px ${70 * u}px`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: (wide ? 26 : 16) * u, alignItems: wide ? "flex-start" : "center", width: wide ? 640 * u : undefined }}>
          <Eyebrow at={20} size={20 * u}>MediaPipe Holistic</Eyebrow>
          <div style={{ fontFamily: FONT.mono, color: C.ink, fontSize: (wide ? 120 : 96) * u, fontWeight: 700, lineHeight: 1 }}>
            <Counter to={543} at={10} dur={60} />
          </div>
          <FadeUp at={40}>
            <div style={{ fontFamily: FONT.body, color: C.muted, fontSize: 30 * u }}>points per frame. No pixels.</div>
          </FadeUp>
          <div style={{ height: 10 * u }} />
          <Words text="This is all the model sees." at={85} size={64 * u} align={wide ? "left" : "center"} highlight={["all"]} />
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 2. question
export const Question: React.FC<{ dur: number }> = ({ dur }) => {
  const { u, wide } = useLayout();
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 * u }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 * u, maxWidth: (wide ? 1500 : 960) * u }}>
          <Eyebrow at={0} size={20 * u}>Project 04 · Computer vision</Eyebrow>
          <Words text="Can a browser read sign language" at={8} size={(wide ? 96 : 80) * u} weight={800} />
          <Words text="without your video ever leaving the device?" at={34} size={(wide ? 96 : 80) * u} weight={800} color={C.muted} highlight={["device?"]} />
          <div style={{ display: "flex", gap: 18 * u, marginTop: 30 * u, flexWrap: "wrap", justifyContent: "center" }}>
            <Chip at={95} size={24 * u}>250 ASL signs</Chip>
            <Chip at={102} size={24 * u}>Live webcam</Chip>
            <Chip at={109} size={24 * u} color={C.accent}>Runs on-device</Chip>
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 3. live demo
const DEMO = ["demo4", "demo2", "demo0"]; // happy, look, radio (left-handed)
const SEG = 135;
const PLAY = 88;

const demoState = (f: number) => {
  const i = Math.min(DEMO.length - 1, Math.floor(f / SEG));
  const lf = f - i * SEG;
  const c = clip(DEMO[i]);
  const t = Math.min(c.frames - 1, lf * (c.frames / PLAY));
  const done = lf > PLAY;
  const swap = interpolate(lf, [0, 8, SEG - 8, SEG], [0, 1, 1, 0], clamp);
  return { i, lf, c, t, done, swap };
};

const DemoStage: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();
  const { u } = useLayout();
  const { i, c, t, done, swap } = demoState(f);
  return (
    <div style={{ width: w, height: h, position: "relative", background: "#020304", borderRadius: 14 * u, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ opacity: swap }}>
        <Skeleton clip={c} t={t} width={w} height={h} loop={false} trails id={`demo${i}`} pad={0.08} />
      </div>
      <div style={{ position: "absolute", left: 18 * u, top: 16 * u, display: "flex", alignItems: "center", gap: 10 * u, fontFamily: FONT.mono, fontSize: 17 * u, color: C.muted }}>
        <span style={{ width: 10 * u, height: 10 * u, borderRadius: 10, background: done ? C.dim : C.bad, boxShadow: done ? undefined : `0 0 12px ${C.bad}` }} />
        {done ? "sign ended · hands dropped" : "capturing"}
      </div>
      <div style={{ position: "absolute", left: 18 * u, bottom: 14 * u, fontFamily: FONT.mono, fontSize: 15 * u, color: C.dim }}>
        replayed landmarks · held-out signer {c.participant}
      </div>
    </div>
  );
};

export const Demo: React.FC<{ dur: number; hasVideo: boolean }> = ({ dur, hasVideo }) => {
  if (hasVideo) return <RealDemo dur={dur} />;
  return <MockDemo dur={dur} />;
};

const MockDemo: React.FC<{ dur: number }> = ({ dur }) => {
  const hasVideo = false;
  const f = useCurrentFrame();
  const { width, height, u, wide } = useLayout();
  const pw = wide ? 1560 * u : width - 80 * u;
  const ph = wide ? 800 * u : height * 0.8;
  const stageW = wide ? pw * 0.6 : pw - 56 * u;
  const stageH = wide ? ph - 130 * u : (ph - 110 * u) * 0.52;
  const st = demoState(f);
  const enter = progress(f, 0, 30);
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `translateY(${(1 - enter) * 60}px) perspective(2000px) rotateX(${(1 - enter) * 12}deg)`, opacity: enter }}>
          <Panel style={{ width: pw, height: ph, padding: 28 * u, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 20 * u }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 * u }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                <span key={c} style={{ width: 13 * u, height: 13 * u, borderRadius: 13, background: c, opacity: 0.8 }} />
              ))}
              <div style={{ marginLeft: 18 * u, flex: 1, fontFamily: FONT.mono, fontSize: 18 * u, color: C.muted, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`, borderRadius: 10 * u, padding: `${8 * u}px ${16 * u}px` }}>
                localhost:8030/demo
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16 * u, color: C.accent }}>● on-device</div>
            </div>
            {hasVideo ? (
              <div style={{ flex: 1, borderRadius: 14 * u, overflow: "hidden", background: "#000" }}>
                <OffthreadVideo src={staticFile("demo.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: wide ? "row" : "column", gap: 28 * u, flex: 1 }}>
                <DemoStage w={stageW} h={stageH} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 * u, padding: wide ? `0 ${12 * u}px` : 0 }}>
                  <div style={{ fontFamily: FONT.mono, fontSize: 18 * u, color: C.muted, letterSpacing: "0.12em" }}>TOP 5 GUESSES</div>
                  {st.done ? (
                    <div style={{ opacity: st.swap }}>
                      <Top5 key={st.i} rows={st.c.top5} at={st.i * SEG + PLAY + 2} width={wide ? pw - stageW - 110 * u : stageW} size={(wide ? 28 : 24) * u} />
                    </div>
                  ) : (
                    <div style={{ fontFamily: FONT.body, fontSize: 26 * u, color: C.dim, opacity: st.swap }}>Sign at a normal pace, then lower your hands…</div>
                  )}
                </div>
              </div>
            )}
          </Panel>
        </div>
        <div style={{ position: "absolute", bottom: (wide ? 40 : 30) * u, display: "flex", gap: 16 * u, flexWrap: "wrap", justifyContent: "center", padding: `0 ${30 * u}px` }}>
          <Chip at={40} size={20 * u} color={C.accent}>~6 ms per sign in the browser</Chip>
          <Chip at={48} size={20 * u}>Video never leaves the device</Chip>
          {wide && <Chip at={56} size={20 * u}>MediaPipe + ONNX Runtime Web</Chip>}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};


// The real demo page, screen-recorded by scripts/capture_demo.mjs (public/demo.mp4, 1920 x 1400).
const CAP_W = 1920;
const CAP_H = 1400;

export const RealDemo: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { width, height, u, wide } = useLayout();
  const pw = wide ? 1120 * u : width - 70 * u;
  const pad = 20 * u;
  const vw = pw - 2 * pad;
  const vh = (vw * CAP_H) / CAP_W;
  const enter = progress(f, 0, 30);
  const zoom = interpolate(f, [0, dur], [1, 1.035]);
  const points = [
    { k: "ONNX", t: "The shipped model.onnx, in ONNX Runtime Web" },
    { k: "=", t: "Same probabilities as the Python API: happy 90.1%" },
    { k: "4", t: "Held-out signers, replayed through the real page" },
    { k: "0", t: "Bytes of video sent anywhere" },
  ];
  const browser = (
    <div style={{ transform: `translateY(${(1 - enter) * 60}px) perspective(2000px) rotateY(${wide ? (1 - enter) * 10 + 4 : 0}deg)`, opacity: enter }}>
      <Panel style={{ width: pw, padding: pad, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14 * u }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 * u }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 12 * u, height: 12 * u, borderRadius: 12, background: c, opacity: 0.8 }} />
          ))}
          <div style={{ marginLeft: 14 * u, flex: 1, fontFamily: FONT.mono, fontSize: 17 * u, color: C.muted, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`, borderRadius: 9 * u, padding: `${7 * u}px ${14 * u}px` }}>
            localhost:8030/demo
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 15 * u, color: C.accent }}>● on-device</div>
        </div>
        <div style={{ width: vw, height: vh, borderRadius: 12 * u, overflow: "hidden", background: "#0f1216" }}>
          <OffthreadVideo src={staticFile("demo.mp4")} muted style={{ width: vw, height: vh, transform: `scale(${zoom})`, transformOrigin: "70% 40%" }} />
        </div>
      </Panel>
    </div>
  );
  if (!wide) {
    return (
      <Scene dur={dur}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 26 * u, padding: 30 * u }}>
          <Eyebrow size={18 * u}>The real app · live in the browser</Eyebrow>
          {browser}
          <div style={{ display: "flex", gap: 12 * u, flexWrap: "wrap", justifyContent: "center" }}>
            <Chip at={40} size={18 * u} color={C.accent}>ONNX Runtime Web</Chip>
            <Chip at={48} size={18 * u}>Same output as the API</Chip>
            <Chip at={56} size={18 * u}>Video never leaves the device</Chip>
          </div>
        </AbsoluteFill>
      </Scene>
    );
  }
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 70 * u, padding: `0 ${90 * u}px` }}>
        {browser}
        <div style={{ display: "flex", flexDirection: "column", gap: 26 * u, width: 560 * u }}>
          <Eyebrow size={20 * u} at={10}>The real app</Eyebrow>
          <Words text="Running live in the browser." at={16} size={62 * u} weight={800} align="left" highlight={["live"]} />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 * u, marginTop: 10 * u }}>
            {points.map((p, i) => (
              <FadeUp key={p.k} at={50 + i * 14}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 * u }}>
                  <div style={{ minWidth: 64 * u, height: 48 * u, borderRadius: 12 * u, border: `1px solid ${C.accent}55`, background: "rgba(94,200,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 17 * u, color: C.accent }}>
                    {p.k}
                  </div>
                  <div style={{ fontFamily: FONT.body, fontSize: 25 * u, color: C.muted, lineHeight: 1.35 }}>{p.t}</div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
