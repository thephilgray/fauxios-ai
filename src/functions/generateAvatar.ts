import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { RunwayML, TaskFailedError } from "@runwayml/sdk"; // Import RunwayML SDK
import { Resource } from "sst";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch"; // Import fetch

const s3 = new S3Client({});

async function fetchFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

interface GenerateAvatarEvent {
  quote: string;
  author: string;
}

export async function handler(event: GenerateAvatarEvent) {
  if (!process.env.RUNWAYML_API_SECRET) {
    throw new Error("RunwayML API key is not set. Please set the 'RunwayApiKey' secret for this stage.");
  }

  const { quote, author } = event;
  const key = `avatars/${uuidv4()}.mp4`;

  const client = new RunwayML(); // Initialize RunwayML client

  const prompt = `An authentic, classic portrait of ${author}, speaking the words: "${quote}". The avatar should look realistic, like a historical painting brought to life.`;

  console.log("PROMPT:", prompt);

  try {
    // 1. Make API call to RunwayML using the SDK
    const task = await client.textToVideo
      .create({
        promptText: prompt, // Corrected property name
        duration: 8, // Required: Using a default of 8 seconds
        model: "veo3.1", // Required: Using a default model
        ratio: "1080:1920", // Required: Matching your Remotion video dimensions
      })
      .waitForTaskOutput();

    const runwayMlVideoUrl = task.output?.[0]; // Assuming output is an array of URLs
    console.log("RunwayML generated video URL:", runwayMlVideoUrl);

    if (!runwayMlVideoUrl) {
      throw new Error("RunwayML task did not return a video URL.");
    }

    // 2. Fetch the video content from RunwayML
    const videoBuffer = await fetchFile(runwayMlVideoUrl);

    // 3. Upload the video content to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: Resource.VideoAssets.name,
        Key: key,
        Body: videoBuffer,
        ContentType: "video/mp4",
      })
    );

    // 4. Generate a signed URL for the uploaded video
    const avatarVideoUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: Resource.VideoAssets.name,
        Key: key,
      }),
      { expiresIn: 3600 } // URL valid for 1 hour
    );

    console.log("Final avatar video URL (signed S3 URL):", avatarVideoUrl);

    return {
      avatarVideoUrl,
      duration: 8, // Return the duration in seconds
    };
  } catch (error) {
    if (error instanceof TaskFailedError) {
      console.error("The RunwayML video task failed:", error.taskDetails);
    } else {
      console.error("An unexpected error occurred:", error);
    }
    throw error;
  }
}
