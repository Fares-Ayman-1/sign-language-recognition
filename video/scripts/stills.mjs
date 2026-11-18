// Render review stills: node scripts/stills.mjs <Composition> <frame> [<frame> ...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const [, , id = "Wide", ...frames] = process.argv;
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id });
for (const fr of frames) {
  const output = path.resolve(`out/stills/${id}-${String(fr).padStart(4, "0")}.png`);
  await renderStill({ composition, serveUrl, frame: Number(fr), output, scale: id === "Wide" ? 0.5 : 0.6 });
  console.log("wrote", output);
}
