import React from "react";
import { registerRoot } from "remotion";
import { VideoComposition } from "./VideoComposition";
import { TruthReelComposition } from "./TruthReelComposition";
import { RevolutionReelComposition } from "./RevolutionReelComposition";

export const RemotionRoots: React.FC = () => {
  return (
    <>
      <VideoComposition />
      <TruthReelComposition />
      <RevolutionReelComposition />
    </>
  );
};

registerRoot(RemotionRoots);
