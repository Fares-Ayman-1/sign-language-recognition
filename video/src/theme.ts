import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const head = loadInterTight("normal", { weights: ["500", "700", "800"], subsets: ["latin"] });
const body = loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

export const FONT = {
  head: head.fontFamily,
  body: body.fontFamily,
  mono: mono.fontFamily,
};

// Same part colours as the live demo (app/web/demo.js), on a deep, cool background.
export const C = {
  bg: "#06080c",
  bg2: "#0b0f16",
  panel: "rgba(255,255,255,0.035)",
  line: "rgba(255,255,255,0.09)",
  ink: "#eef1f6",
  muted: "#8a93a3",
  dim: "#4b5361",
  accent: "#5ec8ff", // dominant (right) hand
  warm: "#ffb347", // left hand
  arm: "#b6f09c", // shoulders to wrists
  face: "rgba(255,255,255,0.38)",
  bad: "#ff6b7a",
};

export const FPS = 30;
