// Screen-record the real demo page (http://localhost:8030/demo/) replaying held-out recordings.
// The page runs the shipped model.onnx in ONNX Runtime Web; predictions on screen are its real output.
// Needs the API running. Usage: node scripts/capture_demo.mjs  ->  capture/demo.webm
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const exe = path.resolve("node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe");
const signs = ["happy", "look", "radio"];
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 700, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await page.goto("http://localhost:8030/demo/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.getElementById("latency").textContent === "ready", { timeout: 60000 });

// Warm up ONNX Runtime Web (the first runs compile kernels), as a live user's session would be.
await page.evaluate(async (obj) => {
  const frames = window.islr.framesFromJson(obj);
  for (let i = 0; i < 8; i++) await window.islr.predict(frames);
  document.getElementById("latency").textContent = "ready";
}, JSON.parse(fs.readFileSync("capture/look.json", "utf8")));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const recorder = await page.screencast({ path: "capture/demo.webm", scale: 2 });
await wait(700);
const results = [];
for (const s of signs) {
  const json = JSON.parse(fs.readFileSync(`capture/${s}.json`, "utf8"));
  const r = await page.evaluate(async (obj) => {
    const frames = window.islr.framesFromJson(obj);
    document.getElementById("frames").textContent = frames.length;
    await window.islr.replay(frames);
    const preds = await window.islr.predict(frames);
    window.islr.show(preds, frames.length);
    return { top: preds[0], latency: document.getElementById("latency").textContent };
  }, json);
  results.push({ sign: s, ...r });
  await wait(s === signs.at(-1) ? 2600 : 2000);
}
await recorder.stop();
await browser.close();
console.log(JSON.stringify(results, null, 1));
