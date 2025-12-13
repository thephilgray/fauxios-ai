import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export async function handler() {
  try {
    const articlesTableName = Resource.Articles.name;
    const scanCommand = new ScanCommand({
      TableName: articlesTableName,
      ProjectionExpression: "topic",
    });

    const { Items: articles } = await ddbDocClient.send(scanCommand);

    if (!articles) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([]),
      };
    }

    const topics = [...new Set(articles.map(article => article.topic || "News").filter(Boolean) as string[])];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(topics),
    };
  } catch (error) {
    console.error("Error in topics handler:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
}
