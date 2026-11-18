import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { SkeletonPalette } from "../Skeleton";
import { C, FONT } from "../kit/theme";
import { Eyebrow, FadeUp, Words, progress, useLayout } from "../kit/ui";

/** Light skeleton: dominant hand navy, other hand gold, arms electric blue, face mesh navy ~30%, no glow. */
export const SK: SkeletonPalette = {
  dominant: C.ink,
  other: C.gold,
  arm: C.blue,
  face: "rgba(12,23,51,0.30)",
  faceSel: C.ink,
  glow: false,
  trail: 0.16,
};

/** Small legend for the skeleton colours (every clip in the video is one-handed, so "other hand" is left out). */
export const Legend: React.FC<{ at?: number; size?: number }> = ({ at = 0, size = 18 }) => {
  const items = [
    { c: SK.dominant, t: "dominant hand" },
    { c: SK.arm, t: "shoulders to wrists" },
  ];
  return (
    <FadeUp at={at} dist={10}>
      <div style={{ display: "flex", gap: size * 1.2, flexWrap: "wrap", justifyContent: "center" }}>
        {items.map((it) => (
          <span key={it.t} style={{ display: "inline-flex", alignItems: "center", gap: size * 0.5, fontFamily: FONT.mono, fontSize: size, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            <span style={{ width: size * 0.65, height: size * 0.65, borderRadius: 99, background: it.c }} />
            {it.t}
          </span>
        ))}
      </div>
    </FadeUp>
  );
};

/** Top-5 guesses as the demo shows them. Values appear final (no counting); only the bars grow. */
export const Top5: React.FC<{ rows: { sign: string; p: number }[]; at?: number; width: number; size?: number; truth?: string }> = ({ rows, at = 0, width, size = 24, truth }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: size * 0.62, width }}>
      {rows.map((r, i) => {
        const g = progress(f, at + i * 4, at + i * 4 + 30);
        const top = i === 0;
        const wrong = truth !== undefined && top && r.sign !== truth;
        const isTruth = truth !== undefined && r.sign === truth;
        const col = wrong ? C.miss : top ? C.gold : isTruth ? C.ink : "rgba(12,23,51,0.22)";
        return (
          <div key={r.sign} style={{ opacity: Math.min(1, g * 2) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: size * 0.28 }}>
              <span style={{ fontFamily: top ? FONT.head : FONT.body, fontWeight: top || isTruth ? 600 : 500, fontSize: top ? size * 1.2 : size, color: top || isTruth ? C.ink : C.muted, letterSpacing: top ? "-0.02em" : undefined }}>
                {r.sign}
              </span>
              <span style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: size * 0.85, color: top ? C.ink : C.muted, fontVariantNumeric: "tabular-nums" }}>{`${(r.p * 100).toFixed(1)}%`}</span>
            </div>
            <div style={{ height: top ? size * 0.42 : size * 0.26, borderRadius: 99, background: "rgba(12,23,51,0.06)", overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0.6, r.p * 100) * g}%`, height: "100%", background: col, borderRadius: 99 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Visual on one side, copy on the other (stacked on square). */
export const Split: React.FC<{ step: string; title: string; highlight?: string[]; visual: (w: number, h: number) => React.ReactNode; children?: React.ReactNode; vhSquare?: number }> = ({
  step,
  title,
  highlight,
  visual,
  children,
  vhSquare = 0.46,
}) => {
  const { width, height, u, wide } = useLayout();
  const vw = wide ? width * 0.48 : width - 120 * u;
  const vh = wide ? height * 0.8 : height * vhSquare;
  return (
    <AbsoluteFill style={{ flexDirection: wide ? "row" : "column", alignItems: "center", justifyContent: "center", gap: (wide ? 50 : 18) * u, padding: (wide ? 80 : 46) * u }}>
      {!wide && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 * u, alignItems: "center", width: "100%" }}>
          <Eyebrow size={17 * u}>{step}</Eyebrow>
          <Words text={title} at={4} size={52 * u} highlight={highlight} maxWidth={width - 100 * u} />
        </div>
      )}
      <div style={{ width: vw, height: vh, position: "relative", flexShrink: 0 }}>{visual(vw, vh)}</div>
      <div style={{ flex: wide ? 1 : undefined, display: "flex", flexDirection: "column", gap: (wide ? 26 : 14) * u, alignItems: wide ? "flex-start" : "center", maxWidth: wide ? 720 * u : undefined }}>
        {wide && (
          <>
            <Eyebrow size={19 * u}>{step}</Eyebrow>
            <Words text={title} at={4} size={72 * u} align="left" highlight={highlight} />
          </>
        )}
        {children}
      </div>
    </AbsoluteFill>
  );
};

/** Body copy sized for the split layout. */
export const Copy: React.FC<{ at: number; children: React.ReactNode; size?: number }> = ({ at, children, size }) => {
  const { u, wide } = useLayout();
  return (
    <FadeUp at={at}>
      <div style={{ fontFamily: FONT.body, fontSize: (size ?? (wide ? 31 : 26)) * u, lineHeight: 1.45, color: C.muted, textAlign: wide ? "left" : "center" }}>{children}</div>
    </FadeUp>
  );
};

/** Navy emphasis inside muted body copy (never gold text on cream). */
export const Em: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: C.ink, fontWeight: 600 }}>{children}</span>;

/** Mono key in a white tile with a gold hairline. */
export const Key: React.FC<{ children: React.ReactNode; size: number; min?: number }> = ({ children, size, min }) => (
  <div
    style={{
      minWidth: min ?? size * 3.6,
      height: size * 2.8,
      padding: `0 ${size * 0.6}px`,
      boxSizing: "border-box",
      borderRadius: size * 0.7,
      border: `1px solid ${C.gold}`,
      background: C.card,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT.mono,
      fontWeight: 700,
      fontSize: size,
      color: C.ink,
      flexShrink: 0,
      letterSpacing: "0.06em",
    }}
  >
    {children}
  </div>
);
