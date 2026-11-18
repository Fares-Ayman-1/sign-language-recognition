import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT } from "./theme";
import { Chip, Eyebrow, FadeUp, Panel, Scene, Words, enter, useLayout } from "./ui";

export const SERIES = [
  { week: 1, title: "Sign Language Recognition", sub: "Real-Time ASL in the Browser" },
  { week: 2, title: "GI Tract MRI Segmentation", sub: "2.5D U-Net for Radiotherapy Planning" },
  { week: 3, title: "H&M Fashion Recommender", sub: "Two-Stage Retrieval + Learning-to-Rank" },
  { week: 4, title: "M5 Demand Forecasting (Walmart)", sub: "30,490 Series, 28 Days Ahead" },
] as const;

export const AUTHOR = { name: "Fares Ayman", role: "AI / ML Engineer" };

/** "Week N of 4" title card. Use as the first scene (or overlay it on a hook visual via `children`). */
export const SeriesTitle: React.FC<{ week: number; dur: number; children?: React.ReactNode }> = ({ week, dur, children }) => {
  const { u, wide } = useLayout();
  const s = SERIES[week - 1];
  return (
    <Scene dur={dur}>
      {children}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 * u }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 * u, maxWidth: (wide ? 1500 : 960) * u }}>
          <Eyebrow size={20 * u}>{`Week ${week} of 4 · ML portfolio`}</Eyebrow>
          <Words text={s.title} at={6} size={(wide ? 104 : 84) * u} weight={600} />
          <Words text={s.sub} at={20} size={(wide ? 46 : 38) * u} weight={600} color={C.muted} lh={1.15} />
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

/** Outro: name, role, links, honest scope line, data credit, and next week's teaser (or the full series in week 4). */
export const SeriesOutro: React.FC<{
  week: number;
  dur: number;
  repo: string; // e.g. github.com/Fares-Ayman-1/gi-tract-segmentation
  kaggle?: string; // e.g. kaggle.com/code/faresayman1/...
  scope: string; // one honest line, e.g. "A research demo, not a medical device."
  credit: string; // dataset credit line
  visual?: React.ReactNode; // optional faint visual behind (right side on wide)
}> = ({ week, dur, repo, kaggle, scope, credit, visual }) => {
  const f = useCurrentFrame();
  const { u, wide } = useLayout();
  const next = SERIES[week]; // undefined in week 4
  return (
    <Scene dur={dur} outF={30}>
      {visual && <AbsoluteFill style={{ opacity: 0.5 }}>{visual}</AbsoluteFill>}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: wide ? "flex-start" : "center", padding: wide ? `0 ${140 * u}px` : `0 ${56 * u}px` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 * u, alignItems: wide ? "flex-start" : "center", maxWidth: (wide ? 1100 : 980) * u }}>
          <Eyebrow size={18 * u}>{`Week ${week} of 4 · ${SERIES[week - 1].title}`}</Eyebrow>
          <Words text={AUTHOR.name} at={6} size={(wide ? 116 : 92) * u} weight={600} align={wide ? "left" : "center"} />
          <FadeUp at={18}>
            <div style={{ fontFamily: FONT.body, fontSize: 34 * u, color: C.muted }}>{AUTHOR.role}</div>
          </FadeUp>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 * u, marginTop: 12 * u, alignItems: wide ? "flex-start" : "center" }}>
            <Chip at={32} size={21 * u}>{repo}</Chip>
            {kaggle && <Chip at={38} size={21 * u}>{kaggle}</Chip>}
          </div>
          <FadeUp at={52}>
            <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 24 * u, color: C.ink, marginTop: 10 * u, textAlign: wide ? "left" : "center" }}>{scope}</div>
          </FadeUp>
          <FadeUp at={58}>
            <div style={{ fontFamily: FONT.mono, fontSize: 15 * u, color: C.muted, textAlign: wide ? "left" : "center" }}>{credit}</div>
          </FadeUp>
          <FadeUp at={72} style={{ marginTop: 18 * u }}>
            {next ? (
              <Panel style={{ padding: `${16 * u}px ${24 * u}px`, display: "flex", gap: 18 * u, alignItems: "center", borderLeft: `6px solid ${C.gold}` }}>
                <span style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 16 * u, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted }}>Next week</span>
                <span style={{ fontFamily: FONT.head, fontWeight: 600, fontSize: 28 * u, color: C.ink, letterSpacing: "-0.02em" }}>{next.title}</span>
              </Panel>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 * u }}>
                {SERIES.map((s, i) => (
                  <div key={s.week} style={{ display: "flex", gap: 14 * u, alignItems: "center", opacity: enter(f, 72 + i * 4) }}>
                    <span style={{ width: 10 * u, height: 10 * u, borderRadius: 10, background: C.gold }} />
                    <span style={{ fontFamily: FONT.mono, fontSize: 16 * u, color: C.muted }}>WEEK {s.week}</span>
                    <span style={{ fontFamily: FONT.head, fontWeight: 600, fontSize: 24 * u, color: C.ink }}>{s.title}</span>
                  </div>
                ))}
              </div>
            )}
          </FadeUp>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
