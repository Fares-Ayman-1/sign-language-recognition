import React from "react";
import { Composition } from "remotion";
import { Main, totalFrames } from "./Main";
import { FPS } from "./theme";
import { MainLight, SCENES_LIGHT } from "./light/Main";
import { totalFrames as totalLight } from "./kit/Timeline";

export const Root: React.FC = () => (
  <>
    <Composition id="Wide" component={Main} durationInFrames={totalFrames()} fps={FPS} width={1920} height={1080} />
    <Composition id="Square" component={Main} durationInFrames={totalFrames()} fps={FPS} width={1080} height={1080} />
    <Composition id="Vertical" component={Main} durationInFrames={totalFrames()} fps={FPS} width={1080} height={1920} />
    {/* Light cut: Quantro AI light kit (src/kit, src/light, scenes-light.json) */}
    <Composition id="WideLight" component={MainLight} durationInFrames={totalLight(SCENES_LIGHT)} fps={FPS} width={1920} height={1080} />
    <Composition id="SquareLight" component={MainLight} durationInFrames={totalLight(SCENES_LIGHT)} fps={FPS} width={1080} height={1080} />
  </>
);
