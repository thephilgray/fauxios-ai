import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Resource } from "sst";
import { Buffer } from 'buffer';
import type { Handler } from "aws-lambda";
import { randomUUID } from "crypto";

const s3Client = new S3Client({});

interface GenerateBiblicalTruthImageEvent {
  truthText: string;
  scriptureText: string;
}

export const handler: Handler<GenerateBiblicalTruthImageEvent> = async (event) => {
  console.log("--- GenerateBiblicalTruthImage handler invoked ---");
  console.log("Received payload:", JSON.stringify(event, null, 2));

  try {
    const { truthText, scriptureText } = event;
    const genAI = new GoogleGenerativeAI(Resource.GeminiApiKey.value);
    const imageGenerationModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image",
    });

    const imagePrompt = `A highly satirical, detailed digital painting of Donald Trump placed in a dramatic Biblical or ancient holy era setting. The style should specifically resemble a classic Renaissance painting. No text. Absurdly humorous. It juxtaposes this quote: "${truthText.substring(0, 300)}" with this biblical verse: "${scriptureText.substring(0, 300)}".`;
    
    console.log("Generating image with prompt:", imagePrompt);
    const imageGenerationResult = await imageGenerationModel.generateContent(imagePrompt);

    const imagePart = imageGenerationResult.response.candidates?.[0]?.content?.parts?.[1];
    if (!imagePart?.inlineData) {
        throw new Error("Image generation failed or returned unexpected format.");
    }

    const originalImageData = imagePart.inlineData.data;
    const originalImageBuffer = Buffer.from(originalImageData, 'base64');

    const bucketKey = `biblical-trump/${randomUUID()}.png`;
    const imagesBucketName = Resource.ProcessedImages.name;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: imagesBucketName,
      Key: bucketKey,
      Body: originalImageBuffer,
      ContentType: imagePart.inlineData.mimeType,
    }));
    
    const imageUrl = `https://${imagesBucketName}.s3.amazonaws.com/${bucketKey}`;
    console.log("Successfully saved biblical truth image:", imageUrl);

    return { 
        imageUrl,
        ...event 
    };

  } catch (error) {
    console.error("Error in GenerateBiblicalTruthImage handler:", error);
    throw error;
  }
};
