import React from "react";
import { Composition } from "remotion";
import { Main, totalFrames } from "./Main";
import { FPS } from "./theme";

export const Root: React.FC = () => (
  <>
    <Composition id="Wide" component={Main} durationInFrames={totalFrames()} fps={FPS} width={1920} height={1080} />
    <Composition id="Square" component={Main} durationInFrames={totalFrames()} fps={FPS} width={1080} height={1080} />
    <Composition id="Vertical" component={Main} durationInFrames={totalFrames()} fps={FPS} width={1080} height={1920} />
  </>
);
