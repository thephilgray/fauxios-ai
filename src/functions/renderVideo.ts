import { renderMediaOnLambda } from "@remotion/lambda/client"; // Import Remotion Lambda client

interface VideoProps { // Renamed RenderVideoEvent to VideoProps for clarity
  headline: string;
  quote: string;
  author: string;
  voiceoverUrl: string;
  animatedCartoonUrl: string;
  avatarVideoUrl: string;
}

export async function handler(event: VideoProps) { // Changed event type to VideoProps
  const { headline, quote, author, voiceoverUrl, animatedCartoonUrl, avatarVideoUrl } = event; // Directly destructure event

  // Input props for your Remotion composition
  const inputProps = {
    headline,
    quote,
    author,
    voiceoverUrl,
    animatedCartoonUrl,
    avatarVideoUrl,
  };

  // Invoke the Remotion Lambda renderer
  const { renderId, bucketName } = await renderMediaOnLambda({
    // This should be the ARN of your deployed Remotion Lambda renderer
    functionName: "arn:aws:lambda:us-east-1:856562418824:function:remotion-render-4-0-365-mem2048mb-disk2048mb-120sec",
    // The URL where your Remotion project is hosted (e.g., S3 bucket)
    serveUrl: "https://remotionlambda-useast1-7npwmcjvq7.s3.us-east-1.amazonaws.com/sites/my-fauxios-video/index.html",
    composition: "FauxiosVideo", // Corrected from compositionId to composition
    inputProps,
    // You might need to specify a region if it's different from the Lambda's region
    region: "us-east-1",
    codec: "h264", // Added required codec property
    // The Remotion Lambda renderer will output the final video to an S3 bucket.
    // You'll need to configure the output bucket in your Remotion CLI deployment
    // or retrieve the URL from the render progress.
  });

  console.log("Remotion render initiated:", { renderId, bucketName });

  // The renderMediaOnLambda function returns a renderId and bucketName.
  // To get the final video URL, you would typically poll getRenderProgress()
  // or use webhooks after the render completes.
  // For now, we'll return the renderId and bucketName.
  return {
    renderId,
    bucketName,
    // You'll need to implement logic to retrieve the final video URL
    // once the render is complete.
  };
}