import React from "react";
import scenesJson from "../../scenes-light.json";
import { Timeline, type SceneSpec } from "../kit/Timeline";
import { Demo, Hook, Question, Title } from "./scenes/Intro";
import { Data, Features, Mirror, Model, Onnx, Points } from "./scenes/Pipeline";
import { Engineering, Eval, Failure, Outro } from "./scenes/Results";

/** Light cut (Quantro AI light kit, no logo). scenes-light.json is the timing source; music_light.py reads it. */
export const SCENES_LIGHT = scenesJson as SceneSpec[];

const registry: Record<string, React.FC<{ dur: number }>> = {
  title: Title,
  hook: Hook,
  question: Question,
  demo: Demo,
  data: Data,
  points: Points,
  mirror: Mirror,
  features: Features,
  model: Model,
  onnx: Onnx,
  eval: Eval,
  failure: Failure,
  eng: Engineering,
  outro: Outro,
};

export const MainLight: React.FC = () => <Timeline scenes={SCENES_LIGHT} registry={registry} music="music-light.mp3" sfx="sfx-light.mp3" />;
