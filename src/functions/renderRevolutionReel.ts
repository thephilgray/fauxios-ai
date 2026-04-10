import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import type { Handler } from "aws-lambda";

interface RenderRevolutionReelEvent {
  truthText: string;
  foundingQuoteText: string;
  foundingReference: string;
  imageUrl: string;
}

export const handler: Handler<RenderRevolutionReelEvent> = async (event) => {
  console.log("--- renderRevolutionReel handler invoked ---");
  
  const { truthText, foundingQuoteText, foundingReference, imageUrl } = event;

  const inputProps = {
    truthText,
    foundingQuoteText,
    foundingReference,
    imageUrl,
    audioUrl: "https://fauxios-project-dev-processedimagesbucket-utnmhzxn.s3.amazonaws.com/audio/runway_track.mp3"
  };

  const functionName = "arn:aws:lambda:us-east-1:856562418824:function:remotion-render-4-0-365-mem2048mb-disk2048mb-120sec";

  const { renderId, bucketName } = await renderMediaOnLambda({
    functionName,
    serveUrl: "https://remotionlambda-useast1-7npwmcjvq7.s3.us-east-1.amazonaws.com/sites/fauxios-revolution-reel/index.html",
    composition: "RevolutionReel",
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
        caption: "The 'Truth' vs The Founding Principle.\n\n#AmericanRevolution #FoundingFathers #Fauxios"
      };
    } else {
        console.log(`Render progress: ${Math.round(progress.overallProgress * 100)}%`);
    }
  }
};
