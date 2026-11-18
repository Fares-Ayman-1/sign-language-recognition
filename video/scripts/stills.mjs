// Render review stills: node scripts/stills.mjs <Composition> <frame> [<frame> ...]
// Dark compositions write to out/stills/, light ones (WideLight, SquareLight) to out/stills-light/.
// STILLS_DIR overrides the folder. Scale: 0.5 for Wide*, 0.6 otherwise. One bundle, one tab.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const [, , id = "Wide", ...frames] = process.argv;
const dir = process.env.STILLS_DIR ?? (id.endsWith("Light") ? "out/stills-light" : "out/stills");
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id });
for (const fr of frames) {
  const output = path.resolve(`${dir}/${id}-${String(fr).padStart(4, "0")}.png`);
  await renderStill({ composition, serveUrl, frame: Number(fr), output, scale: id.startsWith("Wide") ? 0.5 : 0.6 });
  console.log("wrote", output);
}
