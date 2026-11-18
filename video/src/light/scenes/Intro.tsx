import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clip } from "../../data";
import { Skeleton } from "../../Skeleton";
import { hasFile } from "../../kit/Timeline";
import { SeriesTitle } from "../../kit/series";
import { C, FONT } from "../../kit/theme";
import { BrowserFrame, Chip, Counter, Eyebrow, FadeUp, Scene, Words, clamp, progress, useLayout } from "../../kit/ui";
import { DEMO_CLIPS, L, demoSigners, pct } from "../num";
import { Em, Key, SK } from "../parts";

// ---------------------------------------------------------------------------------- 0. series title
export const Title: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { width, height, wide } = useLayout();
  // the hook's skeleton starts assembling faintly behind the title
  return (
    <SeriesTitle week={1} dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 0.1 }}>
        <Skeleton clip={clip("water")} t={0} width={wide ? width * 0.7 : width} height={height} assemble={progress(f, 0, dur + 40) * 0.8} id="title" pad={0.04} palette={SK} />
      </AbsoluteFill>
    </SeriesTitle>
  );
};

// ---------------------------------------------------------------------------------- 1. hook
export const Hook: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { width, height, u, wide } = useLayout();
  const water = clip("water");
  const asm = interpolate(f, [0, 60], [0.8, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  const skH = height * (wide ? 0.86 : 0.58);
  const skW = wide ? width * 0.58 : width;
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: wide ? "center" : "flex-start", paddingTop: wide ? 0 : 40 * u }}>
        <div style={{ position: "relative", width: skW, height: skH, transform: wide ? `translateX(${-width * 0.13}px)` : undefined }}>
          <Skeleton clip={water} t={Math.max(0, f - 30) * 0.5} width={skW} height={skH} assemble={asm} trails={asm > 0.98} id="hook" pad={0.06} palette={SK} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: wide ? "center" : "flex-end", alignItems: wide ? "flex-end" : "center", padding: wide ? `0 ${130 * u}px` : `0 ${60 * u}px ${64 * u}px` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: (wide ? 22 : 12) * u, alignItems: wide ? "flex-start" : "center", width: wide ? 660 * u : undefined }}>
          <Eyebrow at={6} size={18 * u}>MediaPipe Holistic</Eyebrow>
          <div style={{ fontFamily: FONT.head, color: C.ink, fontSize: (wide ? 150 : 100) * u, fontWeight: 700, lineHeight: 0.95, letterSpacing: "-0.04em" }}>
            <Counter to={L.rawPoints} at={8} dur={45} />
          </div>
          <FadeUp at={24}>
            <div style={{ fontFamily: FONT.body, color: C.muted, fontSize: (wide ? 32 : 28) * u }}>points per frame. No pixels.</div>
          </FadeUp>
          <div style={{ height: (wide ? 8 : 2) * u }} />
          <Words text="This is all the model sees." at={62} size={(wide ? 66 : 54) * u} align={wide ? "left" : "center"} highlight={["all"]} />
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
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 70 * u }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 * u, maxWidth: (wide ? 1500 : 960) * u }}>
          <Eyebrow at={0} size={19 * u}>Computer vision · on-device</Eyebrow>
          <Words text="Can a browser read sign language" at={8} size={(wide ? 92 : 74) * u} />
          <Words text="without your video ever leaving the device?" at={30} size={(wide ? 92 : 74) * u} color={C.muted} highlight={["device"]} />
          <div style={{ display: "flex", gap: 16 * u, marginTop: 26 * u, flexWrap: "wrap", justifyContent: "center" }}>
            <Chip at={80} size={22 * u}>{`${L.signs} ASL signs`}</Chip>
            <Chip at={86} size={22 * u}>Live webcam</Chip>
            <Chip at={92} size={22 * u} tone="gold">Runs on-device</Chip>
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------- 3. live demo
// The real /demo/ page in light mode, screen-recorded by scripts/capture_demo_light.mjs (1920 x 1400).
const CAP_W = 1920;
const CAP_H = 1400;
const VIDEO = "demo-light.mp4";

export const Demo: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { width, u, wide } = useLayout();
  const happy = clip(DEMO_CLIPS[0]).top5[0];
  const fw = wide ? 1100 * u : width - 120 * u;
  const vw = fw - 2 * 16 * u - 2;
  const vh = (vw * CAP_H) / CAP_W;
  const e = progress(f, 0, 30);
  const zoom = interpolate(f, [0, dur], [1, 1.03]);
  const screen = hasFile(VIDEO) ? (
    <OffthreadVideo src={staticFile(VIDEO)} muted style={{ width: vw, height: vh, display: "block", transform: `scale(${zoom})`, transformOrigin: "70% 40%" }} />
  ) : (
    <div style={{ width: vw, height: vh, display: "flex", alignItems: "center", justifyContent: "center", background: C.card2, fontFamily: FONT.mono, fontSize: 18 * u, color: C.muted }}>
      public/{VIDEO} missing: run scripts/capture_demo_light.mjs
    </div>
  );
  const browser = (
    <div style={{ transform: `translateY(${(1 - e) * 50}px)`, opacity: e }}>
      <BrowserFrame url="localhost:8030/demo" width={fw}>
        {screen}
      </BrowserFrame>
    </div>
  );
  if (!wide) {
    return (
      <Scene dur={dur}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 22 * u, padding: 30 * u }}>
          <Eyebrow size={17 * u}>The real app · live in the browser</Eyebrow>
          {browser}
          <div style={{ display: "flex", gap: 12 * u, flexWrap: "wrap", justifyContent: "center" }}>
            <Chip at={40} size={18 * u} tone="gold">ONNX Runtime Web</Chip>
            <Chip at={46} size={18 * u}>Same output as the API</Chip>
            <Chip at={52} size={18 * u}>Video stays on the device</Chip>
          </div>
        </AbsoluteFill>
      </Scene>
    );
  }
  const points: { k: string; t: React.ReactNode }[] = [
    { k: "ONNX", t: <>The shipped <Em>model.onnx</Em>, in ONNX Runtime Web</> },
    { k: "API", t: <>Same probabilities as the Python API: <Em>{`${happy.sign} ${pct(happy.p)}`}</Em></> },
    { k: String(demoSigners()), t: <>Held-out signers, replayed through the real page</> },
    { k: "LOCAL", t: <>No video is sent anywhere</> },
  ];
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 64 * u, padding: `0 ${80 * u}px` }}>
        {browser}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 * u, width: 560 * u }}>
          <Eyebrow size={18 * u} at={8}>The real app</Eyebrow>
          <Words text="Running live in the browser." at={14} size={62 * u} align="left" highlight={["live"]} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 * u, marginTop: 8 * u }}>
            {points.map((p, i) => (
              <FadeUp key={p.k} at={44 + i * 12}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 * u }}>
                  <Key size={16 * u} min={84 * u}>{p.k}</Key>
                  <div style={{ fontFamily: FONT.body, fontSize: 24 * u, color: C.muted, lineHeight: 1.35 }}>{p.t}</div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
