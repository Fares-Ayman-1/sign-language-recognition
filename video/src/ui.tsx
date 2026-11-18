import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** Layout helper: u = 1 at 1080 px on the short side; wide = 16:9. */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  return { width, height, u, wide: width / height > 1.3, tall: height / width > 1.3 };
};

export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const drift = f * 0.15;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at ${50 + Math.sin(f / 140) * 8}% ${38 + Math.cos(f / 170) * 6}%, rgba(94,200,255,0.10), transparent 70%),
                       radial-gradient(ellipse 50% 50% at 85% 90%, rgba(255,179,71,0.05), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          backgroundPosition: `${drift}px ${drift}px`,
          opacity: 0.22,
          maskImage: "radial-gradient(ellipse 75% 70% at 50% 50%, black, transparent)",
        }}
      />
      <svg width={width} height={height} style={{ position: "absolute", opacity: 0.06, mixBlendMode: "overlay" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 8} />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65))" }} />
    </AbsoluteFill>
  );
};

/** Fades/blurs a whole scene in and out. */
export const Scene: React.FC<{ dur: number; children: React.ReactNode; inF?: number; outF?: number }> = ({
  dur,
  children,
  inF = 14,
  outF = 14,
}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, inF, dur - outF, dur], [0, 1, 1, 0], clamp);
  const blur = interpolate(f, [0, inF, dur - outF, dur], [10, 0, 0, 10], clamp);
  const sc = interpolate(f, [0, dur], [1.0, 1.025]);
  return (
    <AbsoluteFill style={{ opacity: o, filter: `blur(${blur}px)`, transform: `scale(${sc})` }}>{children}</AbsoluteFill>
  );
};

/** Kinetic headline: each word rises in with a spring, staggered. */
export const Words: React.FC<{
  text: string;
  at?: number;
  size?: number;
  color?: string;
  weight?: number;
  stagger?: number;
  highlight?: string[];
  align?: "center" | "left";
  font?: string;
  maxWidth?: number;
  lh?: number;
}> = ({ text, at = 0, size = 64, color = C.ink, weight = 700, stagger = 3, highlight = [], align = "center", font = FONT.head, maxWidth, lh = 1.12 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div
      style={{
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight: lh,
        letterSpacing: "-0.025em",
        textAlign: align,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        columnGap: size * 0.26,
        maxWidth,
      }}
    >
      {words.map((w, i) => {
        const s = spring({ frame: f - at - i * stagger, fps, config: { damping: 18, stiffness: 120, mass: 0.7 } });
        const hl = highlight.includes(w.replace(/[^\w%.,-]/g, ""));
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.12 }}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - s) * 105}%)`,
                opacity: s,
                color: hl ? C.accent : undefined,
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export const FadeUp: React.FC<{ at?: number; children: React.ReactNode; dist?: number; style?: React.CSSProperties }> = ({
  at = 0,
  children,
  dist = 24,
  style,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 20, stiffness: 110 } });
  return <div style={{ opacity: s, transform: `translateY(${(1 - s) * dist}px)`, ...style }}>{children}</div>;
};

export const Eyebrow: React.FC<{ children: React.ReactNode; at?: number; color?: string; size?: number }> = ({
  children,
  at = 0,
  color = C.accent,
  size = 22,
}) => (
  <FadeUp at={at} dist={12}>
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: size,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span style={{ width: size * 1.6, height: 2, background: color, display: "inline-block" }} />
      {children}
    </div>
  </FadeUp>
);

export const Counter: React.FC<{
  to: number;
  from?: number;
  at?: number;
  dur?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  style?: React.CSSProperties;
}> = ({ to, from = 0, at = 0, dur = 40, decimals = 0, suffix = "", prefix = "", style }) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [at, at + dur], [from, to], { ...clamp, easing: ease });
  const txt = v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}
      {txt}
      {suffix}
    </span>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; at?: number; color?: string; size?: number }> = ({
  children,
  at = 0,
  color = C.ink,
  size = 22,
}) => (
  <FadeUp at={at} dist={14}>
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: size,
        color,
        padding: `${size * 0.5}px ${size * 0.9}px`,
        border: `1px solid ${C.line}`,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 999,
        whiteSpace: "nowrap",
        backdropFilter: "blur(6px)",
      }}
    >
      {children}
    </div>
  </FadeUp>
);

export const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))",
      border: `1px solid ${C.line}`,
      borderRadius: 22,
      boxShadow: "0 40px 120px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Top-5 prediction bars that grow in, the way the live demo shows them. */
export const Top5: React.FC<{
  rows: { sign: string; p: number }[];
  at?: number;
  width: number;
  size?: number;
  truth?: string;
}> = ({ rows, at = 0, width, size = 26, truth }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: size * 0.7, width }}>
      {rows.map((r, i) => {
        const s = spring({ frame: f - at - i * 4, fps, config: { damping: 22, stiffness: 90 } });
        const top = i === 0;
        const wrong = truth !== undefined && top && r.sign !== truth;
        const col = wrong ? C.bad : top ? C.accent : "rgba(255,255,255,0.28)";
        return (
          <div key={r.sign} style={{ opacity: Math.min(1, s * 1.5) }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: top ? FONT.head : FONT.body,
                fontWeight: top ? 700 : 500,
                fontSize: top ? size * 1.25 : size,
                color: top ? C.ink : C.muted,
                marginBottom: size * 0.3,
              }}
            >
              <span>{r.sign}</span>
              <span style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: size * 0.9, color: top ? col : C.muted }}>
                {(r.p * 100 * s).toFixed(1)}%
              </span>
            </div>
            <div style={{ height: top ? 10 : 6, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${r.p * 100 * s}%`,
                  height: "100%",
                  background: col,
                  borderRadius: 6,
                  boxShadow: top ? `0 0 24px ${col}` : undefined,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const progress = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: ease });
