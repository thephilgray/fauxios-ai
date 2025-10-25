import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { RunwayML, TaskFailedError } from "@runwayml/sdk";
import { Resource } from "sst";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";

const s3 = new S3Client({});

async function fetchFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function handler(event: { cartoonImage: string }) {
  if (!process.env.RUNWAYML_API_SECRET) {
    throw new Error("RunwayML API key is not set. Please set the 'RunwayApiKey' secret for this stage.");
  }

  const { cartoonImage } = event;
  const key = `cartoons/${uuidv4()}.mp4`;

  const client = new RunwayML();

  try {
    const imageBuffer = await fetchFile(cartoonImage);
    const dataUri = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

    const task = await client.imageToVideo
      .create({
        model: "gen4_turbo",
        promptImage: dataUri,
        ratio: "720:1280",
      })
      .waitForTaskOutput();

    const videoUrl = task.output?.[0];
    if (!videoUrl) {
      throw new Error("RunwayML task did not return a video URL.");
    }

    const videoBuffer = await fetchFile(videoUrl);

    await s3.send(
      new PutObjectCommand({
        Bucket: Resource.VideoAssets.name,
        Key: key,
        Body: videoBuffer,
        ContentType: "video/mp4",
      })
    );

    const getCommand = new GetObjectCommand({
      Bucket: Resource.VideoAssets.name,
      Key: key,
    });
    const url = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });

    return {
      animatedCartoonUrl: url,
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
