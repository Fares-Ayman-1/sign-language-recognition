import clipsJson from "../public/clips.json";
import metricsJson from "../../reports/metrics.json";
import baselineJson from "../../models/run/baseline.json";

export type Pt = [number, number] | null;
export type Clip = {
  why: string;
  file: string;
  participant: number;
  label: string;
  frames: number;
  handedness: "left" | "right";
  top5: { sign: string; p: number }[];
  landmarks: Pt[][];
};

export const CLIPS = (clipsJson as unknown as { clips: Record<string, Clip> }).clips;
export const clip = (k: string): Clip => {
  const c = CLIPS[k];
  if (!c) throw new Error(`clip ${k} missing: run video/scripts/extract.py`);
  return c;
};

// Every number in the video comes from the project's own reports (MLflow-generated).
const m = metricsJson as unknown as {
  params: { parameters: number; train_sequences: number; valid_sequences: number; epochs: number };
  minutes: number;
  device: string;
  metrics: { top1: number; top5: number; n: number; per_sign: Record<string, number> };
};
const b = baselineJson as {
  majority_top1: number;
  bag_of_frames_top1: number;
  bag_of_frames_top5: number;
};

export const NUM = {
  top1: m.metrics.top1,
  top5: m.metrics.top5,
  heldOut: m.metrics.n,
  train: m.params.train_sequences,
  videos: m.params.train_sequences + m.params.valid_sequences,
  params: m.params.parameters,
  minutes: m.minutes,
  device: m.device,
  majority: b.majority_top1,
  bagTop1: b.bag_of_frames_top1,
  bagTop5: b.bag_of_frames_top5,
  awake: m.metrics.per_sign["awake"],
  water: m.metrics.per_sign["water"],
};

// Landmark layout (src/islr/landmarks.py)
export const OFF = { face: 0, left: 468, pose: 489, right: 522 };
export const LIPS = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 146, 91, 181, 84, 17, 314, 405, 321, 375, 78, 191, 80, 81,
  82, 13, 312, 311, 310, 415, 308, 95, 88, 178, 87, 14, 317, 402, 318, 324,
];
export const NOSE = 1;
export const HAND_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
export const POSE_EDGES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16]];

// The recordings are portrait phone videos; normalised x is stretched relative to y.
export const ASPECT = 0.78;
