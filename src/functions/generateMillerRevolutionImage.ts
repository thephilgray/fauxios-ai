import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Resource } from "sst";
import { Buffer } from 'buffer';
import type { Handler } from "aws-lambda";
import { randomUUID } from "crypto";

const s3Client = new S3Client({});

interface GenerateMillerRevolutionImageEvent {
  truthText: string;
  foundingQuoteText: string;
}

export const handler: Handler<GenerateMillerRevolutionImageEvent> = async (event) => {
  console.log("--- GenerateMillerRevolutionImage handler invoked ---");
  console.log("Received payload:", JSON.stringify(event, null, 2));

  try {
    const { truthText, foundingQuoteText } = event;
    const genAI = new GoogleGenerativeAI(Resource.GeminiApiKey.value);
    const imageGenerationModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image",
    });

    const imagePrompt = `A highly satirical, detailed digital painting in the style of the American Revolution era. Depict former US President Donald Trump dressed majestically and arrogantly as King George III or an 18th-century British royal tyrant. No text. Absurdly humorous. It juxtaposes this quote: "${truthText.substring(0, 300)}" with this founding principle: "${foundingQuoteText.substring(0, 300)}".`;
    
    console.log("Generating image with prompt:", imagePrompt);
    const imageGenerationResult = await imageGenerationModel.generateContent(imagePrompt);

    const imagePart = imageGenerationResult.response.candidates?.[0]?.content?.parts?.[1];
    if (!imagePart?.inlineData) {
        throw new Error("Image generation failed or returned unexpected format.");
    }

    const originalImageData = imagePart.inlineData.data;
    const originalImageBuffer = Buffer.from(originalImageData, 'base64');

    const bucketKey = `revolution-miller/${randomUUID()}.png`;
    const imagesBucketName = Resource.ProcessedImages.name;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: imagesBucketName,
      Key: bucketKey,
      Body: originalImageBuffer,
      ContentType: imagePart.inlineData.mimeType,
    }));
    
    const imageUrl = `https://${imagesBucketName}.s3.amazonaws.com/${bucketKey}`;
    console.log("Successfully saved miller revolution image:", imageUrl);

    return { 
        imageUrl,
        ...event 
    };

  } catch (error) {
    console.error("Error in GenerateMillerRevolutionImage handler:", error);
    throw error;
  }
};
