import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import type { Handler } from "aws-lambda";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

type AssemblePostEvent = {
  articleData: {
    articleId: string;
    title: string;
    headline: string;
    authorId: string;
    authorName: string;
    content: any;
    hook: string;
    topic: string;
    hashtags: string[];
    createdAt: string;
    postedToSocial: string;
  };
  imageData: {
    articleImageUrl: string;
    socialImageUrl: string;
  };
};

export const handler: Handler<AssemblePostEvent> = async (event) => {
  console.log("--- AssemblePost handler invoked ---");
  console.log("Received payload:", JSON.stringify(event, null, 2));

  try {
    const { articleData, imageData } = event;

    const finalPost = {
      ...articleData,
      imageUrl: imageData.articleImageUrl,
      imageVariations: {
        social: imageData.socialImageUrl,
      },
    };

    const articlesTableName = Resource.Articles.name;
    const putCommand = new PutCommand({
      TableName: articlesTableName,
      Item: finalPost,
    });

    await ddbDocClient.send(putCommand);
    console.log("Saved complete article to DynamoDB with ID:", finalPost.articleId);

    return finalPost;

  } catch (error) {
    console.error("Error in AssemblePost handler:", error);
    throw error;
  }
};