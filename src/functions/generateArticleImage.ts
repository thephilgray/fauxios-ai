import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Resource } from "sst";
import { Buffer } from 'buffer';
import sharp from "sharp";
import type { Handler } from "aws-lambda";

const s3Client = new S3Client({});

type GenerateArticleImageEvent = {
  article: {
    articleId: string;
    title: string;
    headline: string;
    authorId: string;
    authorName: string;
    content: any;
    hook: string;
  };
};

export const handler: Handler<GenerateArticleImageEvent> = async (event) => {
  console.log("--- GenerateArticleImage handler invoked ---");
  console.log("Received payload:", JSON.stringify(event, null, 2));

  try {
    const article = event.article;
    const genAI = new GoogleGenerativeAI(Resource.GeminiApiKey.value);
    const imageGenerationModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image-preview",
    });

    let imagePrompt = `A satirical political cartoon in the style of the American Revolutionary era but colorful, related to a satirical article with the headline: \"${article.title}\". 
    For more context, the article hook is: \"${article.hook}\". 
    The image should be absurdly humorous in a subtle way, without text or logos. 
    It should attempt to imagine the real subject or subjects of the news within the dress and settings and conflicts of the past.`;
    if ([article.headline, article.hook, article.title].some(text => text?.toLowerCase()?.includes('trump'))) {
      imagePrompt += ` It should depict the president as a caricature of King George III.`;
    }

    console.log("Generating image with prompt:", imagePrompt);
    const imageGenerationResult = await imageGenerationModel.generateContent(imagePrompt);

    const imagePart = imageGenerationResult.response.candidates?.[0]?.content?.parts?.[1];
    if (!imagePart?.inlineData) {
      throw new Error("Image generation failed or returned unexpected format.");
    }

    const originalImageData = imagePart.inlineData.data;
    const originalImageBuffer = Buffer.from(originalImageData, 'base64');

    // 2. Save the main image to S3
    const articleImageKey = `articles/${article.articleId}.png`;
    const imagesBucketName = Resource.Images.name;
    await s3Client.send(new PutObjectCommand({
      Bucket: imagesBucketName,
      Key: articleImageKey,
      Body: originalImageBuffer,
      ContentType: imagePart.inlineData.mimeType,
    }));
    const articleImageUrl = `https://${imagesBucketName}.s3.amazonaws.com/${articleImageKey}`;
    console.log("Successfully saved article image:", articleImageUrl);

    // 3. Resize the image for social media
    const resizedImageBuffer = await sharp(originalImageBuffer)
      .resize(1200, 628, { fit: "cover" })
      .toBuffer();
    
    const socialImageKey = `social/${article.articleId}.png`;
    const processedImagesBucketName = Resource.ProcessedImages.name;
    await s3Client.send(new PutObjectCommand({
      Bucket: processedImagesBucketName,
      Key: socialImageKey,
      Body: resizedImageBuffer,
      ContentType: "image/png",
    }));
    const socialImageUrl = `https://${processedImagesBucketName}.s3.amazonaws.com/${socialImageKey}`;
    console.log("Successfully generated and saved social image:", socialImageUrl);

    // 4. Return both image URLs
    return { articleImageUrl, socialImageUrl };

  } catch (error) {
    console.error("Error in GenerateArticleImage handler:", error);
    throw error;
  }
};