import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Resource } from "sst";
import { v4 as uuidv4 } from "uuid";

const polly = new PollyClient({});
const s3 = new S3Client({});

export async function handler(event: { headline: string; originalInput: any }) {
  const { headline, originalInput } = event;
  const voiceId = "Matthew";
  const key = `voiceovers/${uuidv4()}.mp3`;

  const speech = await polly.send(
    new SynthesizeSpeechCommand({
      OutputFormat: "mp3",
      Text: headline,
      VoiceId: voiceId,
      Engine: "neural",
    })
  );

  if (!speech.AudioStream) {
    throw new Error("Polly did not return an audio stream.");
  }

  // Convert the audio stream to a buffer
  const streamToBuffer = (stream: any): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on("data", (chunk: any) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });

  const audioBuffer = await streamToBuffer(speech.AudioStream);

  await s3.send(
    new PutObjectCommand({
      Bucket: Resource.VideoAssets.name,
      Key: key,
      Body: audioBuffer,
      ContentType: "audio/mpeg",
    })
  );

  const getCommand = new GetObjectCommand({
    Bucket: Resource.VideoAssets.name,
    Key: key,
  });
  const url = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });

  return {
    voiceoverUrl: url,
    originalInput: originalInput,
  };
}
