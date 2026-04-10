import React from "react";
import { registerRoot } from "remotion";
import { VideoComposition } from "./VideoComposition";
import { TruthReelComposition } from "./TruthReelComposition";

export const RemotionRoots: React.FC = () => {
  return (
    <>
      <VideoComposition />
      <TruthReelComposition />
    </>
  );
};

registerRoot(RemotionRoots);
