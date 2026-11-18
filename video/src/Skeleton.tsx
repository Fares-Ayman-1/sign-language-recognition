import React, { useMemo } from "react";
import { random } from "remotion";
import { ASPECT, Clip, HAND_EDGES, LIPS, NOSE, OFF, POSE_EDGES, Pt } from "./data";
import { C } from "./theme";

type Box = { x0: number; y0: number; x1: number; y1: number };

const LIPSET = new Set(LIPS);

const onCam = (p: Pt) => !!p && p[0] > -0.02 && p[0] < 1.02 && p[1] > -0.02 && p[1] < 1.02;

function bounds(c: Clip): Box {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (p: Pt) => {
    if (onCam(p)) {
      xs.push(p![0] * ASPECT);
      ys.push(p![1]);
    }
  };
  for (const f of c.landmarks) {
    for (let i = 0; i < 468; i += 6) add(f[i]);
    for (let i = 0; i < 21; i++) {
      add(f[OFF.left + i]);
      add(f[OFF.right + i]);
    }
    add(f[OFF.pose + 11]);
    add(f[OFF.pose + 12]);
  }
  const q = (a: number[], t: number) => {
    const s = [...a].sort((u, v) => u - v);
    return s[Math.floor(t * (s.length - 1))];
  };
  return { x0: q(xs, 0.02), x1: q(xs, 0.98), y0: q(ys, 0.02), y1: q(ys, 0.98) };
}

const lerpPt = (a: Pt, b: Pt, t: number): Pt => {
  if (!a) return b && t > 0.5 ? b : null;
  if (!b) return t < 0.5 ? a : null;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
};

/** Landmarks of the clip at fractional frame t (looped), interpolated between recorded frames. */
export function frameAt(c: Clip, t: number, loop = true): Pt[] {
  const n = c.landmarks.length;
  let tt = loop ? ((t % n) + n) % n : Math.max(0, Math.min(n - 1, t));
  const i0 = Math.floor(tt);
  const i1 = loop ? (i0 + 1) % n : Math.min(n - 1, i0 + 1);
  const a = c.landmarks[i0];
  const b = c.landmarks[i1];
  const k = tt - i0;
  return a.map((p, i) => lerpPt(p, b[i], k));
}

export type SkeletonProps = {
  clip: Clip;
  t: number; // fractional clip frame
  width: number;
  height: number;
  loop?: boolean;
  face?: number; // opacity of the full face mesh (0..1)
  selected?: number; // 0..1: highlight the 89 points the model keeps (nose + lips)
  mirror?: number; // 0..1 left-right flip
  assemble?: number; // 0..1: points fly in from a scatter
  trails?: boolean;
  scale?: number;
  pad?: number;
  dim?: number; // 0..1 dims everything
  id?: string;
  crop?: boolean;
};

export const Skeleton: React.FC<SkeletonProps> = ({
  clip,
  t,
  width,
  height,
  loop = true,
  face = 1,
  selected = 0,
  mirror = 0,
  assemble = 1,
  trails = false,
  scale = 1,
  pad = 0.1,
  dim = 0,
  id = "sk",
  crop = true,
}) => {
  const box = useMemo(() => bounds(clip), [clip]);
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  const s = Math.min((width * (1 - 2 * pad)) / bw, (height * (1 - 2 * pad)) / bh) * scale;
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const flip = 1 - 2 * mirror; // 1 -> -1

  const place = (p: Pt, i: number): [number, number] | null => {
    if (!p) return null;
    let x = (p[0] * ASPECT - cx) * s * flip + width / 2;
    let y = (p[1] - cy) * s + height / 2;
    if (assemble < 1) {
      const sx = random(`x${i}`) * width;
      const sy = random(`y${i}`) * height;
      const k = Math.min(1, Math.max(0, assemble * 1.4 - random(`d${i}`) * 0.4));
      const e = 1 - Math.pow(1 - k, 3);
      x = sx + (x - sx) * e;
      y = sy + (y - sy) * e;
    }
    return [x, y];
  };

  const pts = frameAt(clip, t, loop).map(place);
  const swap = mirror > 0.5;
  const leftColor = swap ? C.accent : C.warm;
  const rightColor = swap ? C.warm : C.accent;

  const trailPaths: { d: string; color: string }[] = [];
  if (trails) {
    for (const [off, color] of [
      [OFF.right, rightColor],
      [OFF.left, leftColor],
    ] as [number, string][]) {
      for (const tip of [8, 4]) {
        const segs: string[] = [];
        for (let k = 14; k >= 0; k--) {
          const f = frameAt(clip, t - k * 0.5, loop);
          const p = place(f[off + tip], off + tip);
          if (p) segs.push(`${segs.length ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`);
        }
        if (segs.length > 2) trailPaths.push({ d: segs.join(" "), color });
      }
    }
  }

  const u = Math.min(width, height) / 800;
  const faceDots: React.ReactNode[] = [];
  for (let i = 0; i < 468; i++) {
    const p = pts[i];
    if (!p) continue;
    const isSel = i === NOSE || LIPSET.has(i);
    const op = isSel ? face + (1 - face) * selected : face * (1 - selected * 0.85);
    if (op < 0.01) continue;
    faceDots.push(
      <circle
        key={i}
        cx={p[0]}
        cy={p[1]}
        r={(isSel && selected > 0 ? 2.6 : 1.5) * u}
        fill={isSel && selected > 0 ? "#ffffff" : C.face}
        opacity={op}
      />,
    );
  }

  const hand = (off: number, color: string) => {
    const nodes: React.ReactNode[] = [];
    HAND_EDGES.forEach(([a, b], k) => {
      const p = pts[off + a];
      const q = pts[off + b];
      if (p && q)
        nodes.push(
          <line key={`e${k}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={color} strokeWidth={2.4 * u} strokeOpacity={0.75} strokeLinecap="round" />,
        );
    });
    for (let i = 0; i < 21; i++) {
      const p = pts[off + i];
      if (p) nodes.push(<circle key={`p${i}`} cx={p[0]} cy={p[1]} r={(i % 4 === 0 ? 4.2 : 3.2) * u} fill={color} />);
    }
    return nodes;
  };

  const raw = frameAt(clip, t, loop);
  const poseOk = (i: number) => onCam(raw[OFF.pose + i]);
  const pose: React.ReactNode[] = [];
  POSE_EDGES.forEach(([a, b], k) => {
    const p = pts[OFF.pose + a];
    const q = pts[OFF.pose + b];
    if (p && q && poseOk(a) && poseOk(b))
      pose.push(
        <line key={`pe${k}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={C.arm} strokeWidth={3 * u} strokeOpacity={0.55} strokeLinecap="round" />,
      );
  });
  for (const i of [11, 12, 13, 14, 15, 16]) {
    const p = pts[OFF.pose + i];
    if (p && poseOk(i)) pose.push(<circle key={`pp${i}`} cx={p[0]} cy={p[1]} r={5 * u} fill={C.arm} />);
  }

  return (
    <svg width={width} height={height} style={{ overflow: crop ? "hidden" : "visible", opacity: 1 - dim * 0.75 }}>
      <defs>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={6 * u} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {trailPaths.map((tp, i) => (
        <path key={i} d={tp.d} fill="none" stroke={tp.color} strokeWidth={2 * u} strokeOpacity={0.35} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <g>{faceDots}</g>
      <g>{pose}</g>
      <g filter={`url(#${id}-glow)`}>
        {hand(OFF.left, leftColor)}
        {hand(OFF.right, rightColor)}
      </g>
    </svg>
  );
};
