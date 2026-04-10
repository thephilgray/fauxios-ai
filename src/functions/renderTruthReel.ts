import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import type { Handler } from "aws-lambda";

interface RenderTruthReelEvent {
  truthText: string;
  scriptureText: string;
  scriptureReference: string;
  imageUrl: string;
}

export const handler: Handler<RenderTruthReelEvent> = async (event) => {
  console.log("--- renderTruthReel handler invoked ---");
  
  const { truthText, scriptureText, scriptureReference, imageUrl } = event;

  const inputProps = {
    truthText,
    scriptureText,
    scriptureReference,
    imageUrl,
    audioUrl: "https://fauxios-project-dev-processedimagesbucket-utnmhzxn.s3.amazonaws.com/audio/runway_track.mp3"
  };

  const functionName = "arn:aws:lambda:us-east-1:856562418824:function:remotion-render-4-0-365-mem2048mb-disk2048mb-120sec";

  const { renderId, bucketName } = await renderMediaOnLambda({
    functionName,
    serveUrl: "https://remotionlambda-useast1-7npwmcjvq7.s3.us-east-1.amazonaws.com/sites/fauxios-truth-reel/index.html",
    composition: "TruthReel",
    inputProps,
    region: "us-east-1",
    codec: "h264",
    imageFormat: "jpeg",
  });

  console.log("Remotion render initiated:", { renderId, bucketName });

  // Poll for completion
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region: "us-east-1",
    });

    if (progress.done) {
      if (progress.fatalErrorEncountered) {
        throw new Error(`Render failed: ${JSON.stringify(progress.errors)}`);
      }
      console.log("Render completed! Video URL:", progress.outputFile);
      
      return {
        videoUrl: progress.outputFile,
        caption: "Truth vs. The Word.\n\n#TruthSocial #Bible #Fauxios"
      };
    } else {
        console.log(`Render progress: ${Math.round(progress.overallProgress * 100)}%`);
    }
  }
};
