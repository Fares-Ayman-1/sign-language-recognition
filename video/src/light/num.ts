// Every number in the light cut, in one place. Values come from the project's JSON files; the few that only
// exist in the project README are marked README and cited by line in video/README.md.
import metaJson from "../../../models/meta.json";
import metricsJson from "../../../reports/metrics.json";
import { HAND_EDGES, LIPS, NOSE, NUM, OFF, POSE_EDGES, clip } from "../data";

const meta = metaJson as unknown as { signs: string[]; max_len: number; size_mb: number; onnx_parity_max_abs_diff: number };
const m = metricsJson as unknown as {
  params: { dim: number; convs_per_stage: number; kernel: number; heads: number; valid_participants: number[] };
  metrics: { per_sign: Record<string, number>; confusions: { true: string; pred: string; count: number; of: number }[] };
};

const armPoints = new Set(POSE_EDGES.flat()).size; // shoulders, elbows, wrists (pose 11-16)
const handPoints = new Set(HAND_EDGES.flat()).size; // 21 per hand

export const confusion = (t: string, p: string) => {
  const c = m.metrics.confusions.find((x) => x.true === t && x.pred === p);
  if (!c) throw new Error(`no ${t} -> ${p} confusion in reports/metrics.json`);
  return c;
};

/** Scientific notation as [mantissa, exponent]: 3.58e-7 -> ["3.6", "-7"] (render the exponent as <sup>). */
export const sci = (v: number, d = 1): [string, string] => {
  const [mant, exp] = v.toExponential(d).split("e");
  return [mant, String(Number(exp)).replace("-", "−")];
};

export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

export const L = {
  ...NUM,
  signs: meta.signs.length, // 250, models/meta.json signs
  rawPoints: OFF.right + handPoints, // 543 = 468 face + 21 + 33 pose + 21 (src/islr/landmarks.py layout)
  keptPoints: [NOSE].length + LIPS.length + 2 * handPoints + armPoints, // 89
  lipPoints: LIPS.length, // 40
  heldOutSigners: m.params.valid_participants.length, // 4
  maxLen: meta.max_len, // 64
  sizeMb: meta.size_mb, // 8.46
  parity: meta.onnx_parity_max_abs_diff, // 3.58e-7
  dim: m.params.dim, // 192
  convs: m.params.convs_per_stage, // 3
  kernel: m.params.kernel, // 17
  heads: m.params.heads, // 4
  gain: Math.round((NUM.top1 - NUM.bagTop1) * 100), // +9 points of top-1
  // README only (project README.md): no JSON carries these
  signers: 21, // README line 5: "94,477 videos of 21 signers"
  leftShare: 3, // README line 97: "only about 3% of videos were left-hand dominant"
  features: 398, // README line 101: "398 features per frame"
};

// The three held-out recordings replayed through the real demo page (same as the dark cut).
export const DEMO_CLIPS = ["demo4", "demo2", "demo0"]; // happy, look, radio (left-handed)
export const demoSigners = () => new Set(DEMO_CLIPS.map((k) => clip(k).participant)).size; // 3
