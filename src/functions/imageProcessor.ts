import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { S3Event } from "aws-lambda"; // Changed to type-only import
import { Resource } from "sst";
import sharp, { type FitEnum } from "sharp"; // Image processing library
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const lambdaClient = new LambdaClient({});

export async function handler(event: S3Event) {
  console.log("ImageProcessor handler started.");
  // Added a comment to force redeploy
  try {
    for (const record of event.Records) {
      const bucketName = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' ')); // Original image key

      console.log(`Processing image: s3://${bucketName}/${key}`);

      // 1. Get the original image from S3
      const getObjectCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });
      const { Body } = await s3Client.send(getObjectCommand);

      if (!Body) {
        console.error("No body found for the S3 object.");
        continue;
      }

      const imageBuffer = await (Body as any).transformToByteArray(); // Get image data as Buffer

      // 2. Define desired sizes/crops for social media
      const variations: { name: string; width: number; height: number; fit: keyof FitEnum }[] = [
        { name: "social-square", width: 600, height: 600, fit: "cover" },
        { name: "social-wide", width: 1200, height: 628, fit: "cover" },
        // Add more variations as needed
      ];

      const articleId = key.split('/')[1].split('.')[0]; // Extract articleId from key (e.g., articles/article-123.png)
      const articleImageUrls: { [key: string]: string } = {};

      for (const variation of variations) {
        const resizedImageBuffer = await sharp(imageBuffer)
          .resize(variation.width, variation.height, { fit: variation.fit })
          .toBuffer();

        const processedImagesBucketName = Resource.ProcessedImages.name; // Get the name of the new bucket directly from Resource
        const variationKey = `${variation.name}-${articleId}.png`; // Key within the new bucket (no prefix needed)
        const putObjectCommand = new PutObjectCommand({
          Bucket: processedImagesBucketName, // Use the new bucket
          Key: variationKey,
          Body: resizedImageBuffer,
          ContentType: "image/png", // Assuming PNG output for variations
        });
        await s3Client.send(putObjectCommand);

        const variationUrl = `https://${processedImagesBucketName}.s3.amazonaws.com/${variationKey}`; // Use the new bucket name in the URL
        articleImageUrls[variation.name] = variationUrl;
        console.log(`Generated variation ${variation.name}: ${variationUrl}`);
      }

      // 3. Update DynamoDB with variation URLs
      const articlesTableName = Resource.Articles.name;
      const updateCommand = new UpdateCommand({
        TableName: articlesTableName,
        Key: { articleId: articleId },
        UpdateExpression: "SET imageVariations = :iv",
        ExpressionAttributeValues: {
          ":iv": JSON.stringify(articleImageUrls),
        },
      });
      await ddbDocClient.send(updateCommand);
      console.log(`Updated DynamoDB for article ${articleId} with image variations.`);

      // 4. Invoke SocialMediaPoster function
      const socialMediaPosterFunctionName = Resource.SocialMediaPoster.name;
      const invokeCommand = new InvokeCommand({
        FunctionName: socialMediaPosterFunctionName,
        InvocationType: "Event", // Invoke asynchronously
        Payload: JSON.stringify({ articleId: articleId }), // Pass articleId to the poster
      });
      await lambdaClient.send(invokeCommand);
      console.log(`Invoked SocialMediaPoster for article ${articleId}.`);
    }
  } catch (error) {
    console.error("Error in ImageProcessor:", error);
    throw error;
  }
  console.log("ImageProcessor handler finished.");
}