import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, ENTER, FONT, SHADOW, STAGGER } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ease = Easing.bezier(...EASE);

/** 0 -> 1 over [a, b] with the brand easing. */
export const progress = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: ease });
/** Standard entrance starting at frame `at`. */
export const enter = (f: number, at: number, dur = ENTER) => progress(f, at, at + dur);

/** u = 1 at 1080 px on the short side; wide = 16:9, square = 1:1. */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  return { width, height, u, wide: width / height > 1.3, square: Math.abs(width - height) < 10 };
};

/** Cream ground, faint navy grid, low-alpha gold/blue aurora, halftone gold dots in one corner. */
export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const drift = f * 0.12;
  const dots: React.ReactNode[] = [];
  const step = 22;
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 13; x++) {
      const r = Math.max(0, 3.2 - (x + y) * 0.22);
      if (r > 0.3) dots.push(<circle key={`${x}-${y}`} cx={width - 40 - x * step} cy={height - 40 - y * step} r={r} fill={C.gold} opacity={0.55} />);
    }
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 55% at ${80 + Math.sin(f / 160) * 5}% ${20 + Math.cos(f / 190) * 5}%, rgba(126,164,255,0.16), transparent 70%),
                       radial-gradient(55% 50% at 12% 92%, rgba(211,174,108,0.20), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(12,23,51,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(12,23,51,0.05) 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          backgroundPosition: `${drift}px ${drift}px`,
          maskImage: "radial-gradient(ellipse 80% 75% at 50% 50%, black, transparent)",
        }}
      />
      <svg width={width} height={height} style={{ position: "absolute" }}>
        {dots}
      </svg>
    </AbsoluteFill>
  );
};

/** Fades a whole scene in and out (soft blur + slow push). */
export const Scene: React.FC<{ dur: number; children: React.ReactNode; inF?: number; outF?: number }> = ({ dur, children, inF = 14, outF = 14 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, inF, dur - outF, dur], [0, 1, 1, 0], clamp);
  const blur = interpolate(f, [0, inF, dur - outF, dur], [8, 0, 0, 8], clamp);
  const sc = interpolate(f, [0, dur], [1, 1.02]);
  return <AbsoluteFill style={{ opacity: o, filter: `blur(${blur}px)`, transform: `scale(${sc})` }}>{children}</AbsoluteFill>;
};

/**
 * Kinetic headline: each word rises in with the brand easing (no overshoot).
 * `highlight` words get a gold highlighter fill behind navy text (PROPOSED: gold text is reserved for navy grounds).
 * Use at most one highlighted word or short phrase per headline.
 */
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
}> = ({ text, at = 0, size = 64, color = C.ink, weight = 600, stagger = STAGGER, highlight = [], align = "center", font = FONT.head, maxWidth, lh = 1.06 }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily: font, fontSize: size, fontWeight: weight, color, lineHeight: lh, letterSpacing: "-0.035em", textAlign: align, display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", columnGap: size * 0.24, maxWidth }}>
      {words.map((w, i) => {
        const s = enter(f, at + i * stagger);
        const hl = highlight.includes(w.replace(/[^\w%.,'&-]/g, "")) || highlight.includes(w);
        const hs = enter(f, at + i * stagger + 10, 18);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.1, position: "relative" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - s) * 100}%)`, opacity: s, position: "relative" }}>
              {hl && (
                <span style={{ position: "absolute", left: -size * 0.06, right: -size * 0.06, bottom: size * 0.06, height: size * 0.36, background: C.gold, opacity: 0.55, transformOrigin: "left", transform: `scaleX(${hs})`, borderRadius: size * 0.06, zIndex: 0 }} />
              )}
              <span style={{ position: "relative", zIndex: 1 }}>{w}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
};

export const FadeUp: React.FC<{ at?: number; children: React.ReactNode; dist?: number; style?: React.CSSProperties }> = ({ at = 0, children, dist = 26, style }) => {
  const f = useCurrentFrame();
  const s = enter(f, at);
  return <div style={{ opacity: s, transform: `translateY(${(1 - s) * dist}px)`, ...style }}>{children}</div>;
};

/** Mono uppercase eyebrow inside a gold-hairline pill with a 7px gold dot. */
export const Eyebrow: React.FC<{ children: React.ReactNode; at?: number; size?: number }> = ({ children, at = 0, size = 18 }) => (
  <FadeUp at={at} dist={12}>
    <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.6, fontFamily: FONT.mono, fontWeight: 500, fontSize: size, letterSpacing: "0.18em", textTransform: "uppercase", color: C.ink, padding: `${size * 0.5}px ${size * 0.95}px`, border: `1px solid ${C.gold}`, borderRadius: 999, background: "rgba(255,255,255,0.6)" }}>
      <span style={{ width: 7 * (size / 14), height: 7 * (size / 14), borderRadius: 99, background: C.gold, display: "inline-block" }} />
      {children}
    </div>
  </FadeUp>
);

/** Pill chip (mono label). `tone="gold"` = gold fill with navy label. */
export const Chip: React.FC<{ children: React.ReactNode; at?: number; size?: number; tone?: "plain" | "gold" }> = ({ children, at = 0, size = 20, tone = "plain" }) => (
  <FadeUp at={at} dist={14}>
    <div style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: size, color: C.ink, padding: `${size * 0.5}px ${size * 0.95}px`, border: `1px solid ${tone === "gold" ? C.gold : C.line}`, background: tone === "gold" ? C.gold : C.card, borderRadius: 999, whiteSpace: "nowrap", boxShadow: tone === "gold" ? SHADOW.goldGlow : SHADOW.card }}>
      {children}
    </div>
  </FadeUp>
);

/** White card: 22px radius, hairline, soft negative-spread shadow. */
export const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; float?: boolean }> = ({ children, style, float }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 22, boxShadow: float ? SHADOW.float : SHADOW.card, ...style }}>{children}</div>
);

export const Counter: React.FC<{ to: number; from?: number; at?: number; dur?: number; decimals?: number; suffix?: string; prefix?: string; style?: React.CSSProperties }> = ({ to, from = 0, at = 0, dur = 40, decimals = 0, suffix = "", prefix = "", style }) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [at, at + dur], [from, to], { ...clamp, easing: ease });
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}
      {v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
};

/** Horizontal bars that grow in. `hero` row is navy-labelled with a gold bar; `miss` rows use the miss fill. */
export type Bar = { label: string; value: number; display?: string; hero?: boolean; miss?: boolean; note?: string };
export const BarList: React.FC<{ rows: Bar[]; at?: number; width: number; max?: number; size?: number; gap?: number }> = ({ rows, at = 0, width, max, size = 26, gap }) => {
  const f = useCurrentFrame();
  const m = max ?? Math.max(...rows.map((r) => r.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: gap ?? size * 0.9, width }}>
      {rows.map((r, i) => {
        const g = progress(f, at + i * 8, at + i * 8 + 40);
        const col = r.miss ? C.miss : r.hero ? C.gold : "rgba(12,23,51,0.28)";
        return (
          <div key={r.label + i} style={{ opacity: Math.min(1, g * 2) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: size * 0.35 }}>
              <span style={{ fontFamily: r.hero ? FONT.head : FONT.body, fontWeight: r.hero ? 600 : 500, fontSize: r.hero ? size * 1.15 : size, color: r.hero ? C.ink : C.muted, letterSpacing: r.hero ? "-0.02em" : undefined }}>{r.label}</span>
              <span style={{ display: "flex", gap: size * 0.8, alignItems: "baseline" }}>
                {r.note && <span style={{ fontFamily: FONT.mono, fontSize: size * 0.7, color: C.muted }}>{r.note}</span>}
                <span style={{ fontFamily: FONT.head, fontWeight: 600, fontSize: r.hero ? size * 1.5 : size * 1.1, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{r.display ?? r.value.toFixed(3)}</span>
              </span>
            </div>
            <div style={{ height: r.hero ? size * 0.55 : size * 0.36, background: "rgba(12,23,51,0.06)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${(r.value / m) * 100 * g}%`, height: "100%", background: col, borderRadius: 99, boxShadow: r.hero ? SHADOW.goldGlow : undefined }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Card with a big number + one line, for insights. */
export const Callout: React.FC<{ at?: number; big: string; children: React.ReactNode; width?: number }> = ({ at = 0, big, children, width }) => {
  const { u } = useLayout();
  return (
    <FadeUp at={at}>
      <Panel style={{ padding: `${22 * u}px ${32 * u}px`, display: "flex", gap: 26 * u, alignItems: "center", width, boxSizing: "border-box", borderLeft: `6px solid ${C.gold}` }}>
        <div style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: 58 * u, color: C.ink, lineHeight: 1, letterSpacing: "-0.04em", whiteSpace: "nowrap" }}>{big}</div>
        <div style={{ fontFamily: FONT.body, fontSize: 26 * u, color: C.muted, lineHeight: 1.45 }}>{children}</div>
      </Panel>
    </FadeUp>
  );
};

/** Body paragraph in the muted colour. */
export const Body: React.FC<{ at?: number; children: React.ReactNode; size?: number; align?: "left" | "center"; color?: string }> = ({ at = 0, children, size = 30, align, color = C.muted }) => {
  const { u, wide } = useLayout();
  return (
    <FadeUp at={at}>
      <div style={{ fontFamily: FONT.body, fontSize: size * u, lineHeight: 1.55, color, textAlign: align ?? (wide ? "left" : "center") }}>{children}</div>
    </FadeUp>
  );
};

/** A browser-window frame (white card) for real-app screen captures. */
export const BrowserFrame: React.FC<{ url: string; width: number; children: React.ReactNode }> = ({ url, width, children }) => {
  const { u } = useLayout();
  return (
    <Panel float style={{ width, padding: 16 * u, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12 * u }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 * u }}>
        {[C.miss, C.gold, C.green].map((c) => (
          <span key={c} style={{ width: 12 * u, height: 12 * u, borderRadius: 12, background: c }} />
        ))}
        <div style={{ marginLeft: 12 * u, flex: 1, fontFamily: FONT.mono, fontSize: 16 * u, color: C.muted, background: C.card2, border: `1px solid ${C.line}`, borderRadius: 999, padding: `${6 * u}px ${16 * u}px` }}>{url}</div>
      </div>
      <div style={{ borderRadius: 12 * u, overflow: "hidden", border: `1px solid ${C.line}` }}>{children}</div>
    </Panel>
  );
};
