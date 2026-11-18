// Quantro AI light theme for the 4-week project video series (no Quantro logo anywhere).
// Colours and type are the brand's observed web tokens; values marked PROPOSED are video-only proposals.
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadHanken } from "@remotion/google-fonts/HankenGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const sora = loadSora("normal", { weights: ["600", "700"], subsets: ["latin"] });
const hanken = loadHanken("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["500", "700"], subsets: ["latin"] });

export const FONT = {
  head: sora.fontFamily, // Sora 600/700: headings and numbers, tight tracking
  body: hanken.fontFamily, // Hanken Grotesk: body, UI
  mono: mono.fontFamily, // JetBrains Mono 500 uppercase +0.18em: eyebrows, labels, chips
};

export const C = {
  // grounds and surfaces
  bg: "#F5F1EA", // cream
  card: "#FFFFFF",
  card2: "#FBF8F2",
  line: "#E5DFD0", // 1px hairlines
  // ink
  ink: "#0C1733", // navy
  muted: "rgba(12,23,51,0.62)",
  faint: "rgba(12,23,51,0.40)", // decorative only, never body text
  // gold: FILLS ONLY on light (bars, dots, rules, highlighter). Never small gold text on cream.
  gold: "#D3AE6C",
  goldBright: "#E3C58A",
  goldDeep: "#B8914F", // text only when LARGE and BOLD (2.59:1 on cream)
  goldSoft: "rgba(211,174,108,0.22)", // highlighter / tinted tiles
  // data illustration only (never UI chrome)
  blue: "#7EA4FF",
  blueSoft: "rgba(126,164,255,0.22)",
  green: "#62D6A2",
  // PROPOSED: the brand has no error colour on light; misses use this fill with navy labels
  miss: "#FFB4A8",
  // categorical order for charts: navy, gold, blue, green, then muted navy
  series: ["#0C1733", "#D3AE6C", "#7EA4FF", "#62D6A2", "rgba(12,23,51,0.35)"],
};

// Brand easing cubic-bezier(.16,1,.3,1); entrances ~800 ms (24 frames), stagger ~80 ms (2-3 frames). No bounce.
export const EASE = [0.16, 1, 0.3, 1] as const;
export const FPS = 30;
export const ENTER = 24;
export const STAGGER = 3;

export const SHADOW = {
  card: "0 1px 2px rgba(12,23,51,.04), 0 18px 40px -28px rgba(12,23,51,.22)",
  float: "0 2px 4px rgba(12,23,51,.05), 0 40px 90px -50px rgba(12,23,51,.35)",
  goldGlow: "0 10px 26px -12px rgba(211,174,108,.7)",
};
