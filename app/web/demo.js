// Live sign recognition: MediaPipe Holistic landmarks -> ONNX model (preprocessing is inside the graph).
// The model expects raw landmarks [frames, 543, 3] in this order: face 468, left hand 21, pose 33,
// right hand 21; NaN where a part was not detected. Exactly what the training data contains.
"use strict";

const N = 543;
const OFFSET = { face: 0, left_hand: 468, pose: 489, right_hand: 522 };
const IDLE_END = 6;        // frames without hands that end a sign in auto mode
const MIN_HAND_FRAMES = 4; // shorter "signs" are ignored (a hand passing by)
const MAX_FRAMES = 150;    // about 5 seconds at 30 fps
const RECORD_MS = 2000;

const $ = (id) => document.getElementById(id);
const state = { session: null, signs: [], holistic: null, frames: [], handFrames: 0, idle: 0,
                active: false, recordUntil: 0, running: false, history: [] };

function frameFromResults(r) {
  const f = new Float32Array(N * 3).fill(NaN);
  const put = (pts, off) => {
    if (!pts) return;
    for (let i = 0; i < pts.length; i++) {
      f[(off + i) * 3] = pts[i].x; f[(off + i) * 3 + 1] = pts[i].y; f[(off + i) * 3 + 2] = pts[i].z;
    }
  };
  put(r.faceLandmarks && r.faceLandmarks.slice(0, 468), OFFSET.face);
  put(r.leftHandLandmarks, OFFSET.left_hand);
  put(r.poseLandmarks, OFFSET.pose);
  put(r.rightHandLandmarks, OFFSET.right_hand);
  return f;
}

// frames: array of Float32Array(543 * 3) -> [{sign, probability}] (top 5)
async function predict(frames) {
  const t = frames.length;
  const data = new Float32Array(t * N * 3);
  frames.forEach((f, i) => data.set(f, i * N * 3));
  const t0 = performance.now();
  const out = await state.session.run({ landmarks: new ort.Tensor("float32", data, [t, N, 3]) });
  const ms = performance.now() - t0;
  const probs = out.probabilities.data;
  const top = Array.from(probs.keys()).sort((a, b) => probs[b] - probs[a]).slice(0, 5);
  $("latency").textContent = `${ms.toFixed(0)} ms`;
  return top.map((i) => ({ sign: state.signs[i], probability: probs[i] }));
}

function show(preds, frames) {
  $("preds").innerHTML = preds.map((p) => `
    <li><span class="name">${p.sign}</span><span class="pct">${(100 * p.probability).toFixed(1)}%</span>
    <span class="bar"><i style="width:${(100 * p.probability).toFixed(1)}%"></i></span></li>`).join("");
  state.history.unshift(preds[0].sign);
  state.history = state.history.slice(0, 8);
  $("history").textContent = `Recent: ${state.history.join(" · ")} (last sign: ${frames} frames)`;
}

async function finish() {
  const frames = state.frames;
  const enough = state.handFrames >= MIN_HAND_FRAMES;
  state.frames = []; state.handFrames = 0; state.idle = 0; state.active = false; state.recordUntil = 0;
  $("mode").textContent = "auto: a sign ends when your hands drop";
  $("record").disabled = false;
  if (!enough) return;
  show(await predict(frames), frames.length);
}

// One frame (Float32Array of 543 * 3) on the overlay: faint face, both hands, shoulders to wrists.
function drawFrame(f, w, h) {
  const c = $("overlay");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.clearRect(0, 0, w, h);
  const part = (from, to, color, size) => {
    g.fillStyle = color;
    for (let i = from; i < to; i++) {
      const x = f[i * 3], y = f[i * 3 + 1];
      if (Number.isNaN(x)) continue;
      g.beginPath(); g.arc(x * w, y * h, size, 0, 2 * Math.PI); g.fill();
    }
  };
  part(OFFSET.face, OFFSET.left_hand, "rgba(255,255,255,0.35)", 1.2);
  part(OFFSET.pose + 11, OFFSET.pose + 17, "#b6f09c", 5);
  part(OFFSET.left_hand, OFFSET.pose, "#ffb347", 4);
  part(OFFSET.right_hand, N, "#5ec8ff", 4);
}

function draw(r) {
  const v = $("video");
  drawFrame(frameFromResults(r), v.videoWidth, v.videoHeight);
}

// Replay a loaded landmark file on the canvas (30 fps), so you can see what the model was given.
async function replay(frames) {
  if (state.running) return;  // the camera owns the canvas
  if ($("placeholder")) $("placeholder").style.display = "none";
  const stage = $("overlay").parentElement;
  for (const f of frames) {
    drawFrame(f, stage.clientWidth, stage.clientHeight);
    await new Promise((r) => setTimeout(r, 33));
  }
}

async function onResults(r) {
  draw(r);
  const hands = Boolean(r.leftHandLandmarks || r.rightHandLandmarks);
  $("hands").textContent = hands ? "yes" : "no";
  $("hand-dot").classList.toggle("on", hands);
  const frame = frameFromResults(r);
  if (state.recordUntil) {                       // manual mode: record a fixed window
    state.frames.push(frame); state.handFrames += hands ? 1 : 0;
    if (performance.now() >= state.recordUntil) await finish();
  } else if (hands) {                            // auto mode: a sign runs while hands are visible
    state.active = true; state.idle = 0; state.frames.push(frame); state.handFrames++;
  } else if (state.active) {
    state.idle++; state.frames.push(frame);
    if (state.idle >= IDLE_END) { state.frames.splice(-IDLE_END); await finish(); }
  }
  if (state.frames.length >= MAX_FRAMES) await finish();
  $("frames").textContent = state.frames.length;
}

async function loop() {
  if (!state.running) return;
  const v = $("video");
  if (v.readyState >= 2) await state.holistic.send({ image: v });
  requestAnimationFrame(loop);
}

async function startCamera() {
  $("start").disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    $("video").srcObject = stream;
    await $("video").play();
  } catch (e) {
    $("placeholder").innerHTML = `<span class="warn">Camera unavailable (${e.name}). You can still load a landmark JSON file.</span>`;
    $("start").disabled = false;
    return;
  }
  $("placeholder").remove();
  state.holistic = new Holistic({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${f}`,
  });
  // the competition data came from MediaPipe Holistic: same model, 468 face points (no iris refinement)
  state.holistic.setOptions({ modelComplexity: 1, smoothLandmarks: true, refineFaceLandmarks: false,
                              minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
  state.holistic.onResults(onResults);
  state.running = true;
  $("record").disabled = false;
  loop();
}

// JSON in the API's format: {"frames": [{"face": [[x,y,z]...], "left_hand": ..., "pose": ..., "right_hand": ...}]}
function framesFromJson(obj) {
  return obj.frames.map((fr) => {
    const f = new Float32Array(N * 3).fill(NaN);
    for (const [part, off] of Object.entries(OFFSET)) {
      (fr[part] || []).forEach((p, i) => { f[(off + i) * 3] = p[0]; f[(off + i) * 3 + 1] = p[1]; f[(off + i) * 3 + 2] = p[2] ?? 0; });
    }
    return f;
  });
}

async function init() {
  ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
  const meta = await (await fetch("meta.json")).json();
  state.signs = meta.signs;
  $("acc").textContent = `${(100 * meta.valid_top1).toFixed(0)}%`;
  $("acc5").textContent = `${(100 * meta.valid_top5).toFixed(0)}%`;
  state.session = await ort.InferenceSession.create("model.onnx", { executionProviders: ["wasm"] });
  $("latency").textContent = "ready";
  const render = (q) => {
    $("signs").innerHTML = state.signs.filter((s) => s.includes(q.toLowerCase())).sort()
      .map((s) => `<span>${s}</span>`).join("");
  };
  render("");
  $("search").addEventListener("input", (e) => render(e.target.value));
  $("start").addEventListener("click", startCamera);
  $("record").addEventListener("click", () => {
    state.frames = []; state.handFrames = 0; state.recordUntil = performance.now() + RECORD_MS;
    $("mode").textContent = "recording 2 s"; $("record").disabled = true;
  });
  $("file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const frames = framesFromJson(JSON.parse(await file.text()));
    replay(frames);
    show(await predict(frames), frames.length);
  });
  window.islr = { predict, framesFromJson, replay, show };  // for automated checks
}

init().catch((e) => { $("latency").textContent = "failed to load"; console.error(e); });
