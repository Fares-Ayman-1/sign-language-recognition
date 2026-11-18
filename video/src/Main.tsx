import React from "react";
import { AbsoluteFill, Audio, Sequence, getStaticFiles, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Demo, Hook, Question } from "./scenes/Intro";
import { Data, Features, Mirror, Model, Onnx, Points } from "./scenes/Pipeline";
import { Engineering, Eval, Failure, Outro } from "./scenes/Results";
import { C } from "./theme";
import { Background, clamp } from "./ui";

type S = { key: string; dur: number; el: (dur: number) => React.ReactNode };

const has = (name: string) => getStaticFiles().some((f) => f.name === name);

export const SCENES = (): S[] => [
  { key: "hook", dur: 180, el: (d) => <Hook dur={d} /> },
  { key: "question", dur: 200, el: (d) => <Question dur={d} /> },
  { key: "demo", dur: has("demo.mp4") ? 525 : 405, el: (d) => <Demo dur={d} hasVideo={has("demo.mp4")} /> },
  { key: "data", dur: 165, el: (d) => <Data dur={d} /> },
  { key: "points", dur: 160, el: (d) => <Points dur={d} /> },
  { key: "mirror", dur: 165, el: (d) => <Mirror dur={d} /> },
  { key: "features", dur: 140, el: (d) => <Features dur={d} /> },
  { key: "model", dur: 165, el: (d) => <Model dur={d} /> },
  { key: "onnx", dur: 165, el: (d) => <Onnx dur={d} /> },
  { key: "eval", dur: 330, el: (d) => <Eval dur={d} /> },
  { key: "failure", dur: 300, el: (d) => <Failure dur={d} /> },
  { key: "eng", dur: 165, el: (d) => <Engineering dur={d} /> },
  { key: "outro", dur: 210, el: (d) => <Outro dur={d} /> },
];

const OVERLAP = 10; // scenes cross-fade

export const totalFrames = () => SCENES().reduce((a, s) => a + s.dur - OVERLAP, OVERLAP);

const ProgressLine: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  return <div style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: (f / durationInFrames) * width, background: C.accent, opacity: 0.7 }} />;
};

export const Main: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const f = useCurrentFrame();
  let at = 0;
  const music = has("music.mp3");
  const sfx = has("sfx.mp3");
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Background />
      {SCENES().map((s) => {
        const from = at;
        at += s.dur - OVERLAP;
        return (
          <Sequence key={s.key} from={from} durationInFrames={s.dur} name={s.key}>
            {s.el(s.dur)}
          </Sequence>
        );
      })}
      <ProgressLine />
      {music && (
        <Audio
          src={staticFile("music.mp3")}
          volume={(fr) => interpolate(fr, [0, 30, durationInFrames - 60, durationInFrames], [0, 0.5, 0.5, 0], clamp)}
        />
      )}
      {sfx && <Audio src={staticFile("sfx.mp3")} volume={0.85} />}
    </AbsoluteFill>
  );
};
